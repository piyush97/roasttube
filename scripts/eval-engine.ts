// A1: LLM engine head-to-head evaluator.
//
// Builds the REAL roast prompt (src/lib/prompt.ts) for each demo persona
// (src/lib/demo.ts) and asks every candidate engine to produce a roast.
// Raw responses are saved under docs/superpowers/notes/assets/engine-eval/
// so roast quality can be compared engine by engine (run metadata included).
//
// Candidate call paths:
//   - gemini-3.5-flash:  the production shape from src/lib/gemini.ts
//                        (systemInstruction + contents + responseSchema).
//   - Workers AI models: REST  POST /accounts/<id>/ai/run/<model>  when
//                        CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN are
//                        present in the environment, otherwise the cached
//                        `cf ai run` CLI auth (no token ever handled here).
//
// Usage: node --env-file=.env.local scripts/eval-engine.ts [--only=slug,slug] [--variant=raw|jsonfmt]
//
// Variants:
//   raw     — production-faithful: exactly buildSystemPrompt() + buildUserPrompt()
//             plus whatever the engine enforces natively (Gemini responseSchema).
//   jsonfmt — adaptation test: same prompts, plus an explicit JSON output
//             contract appended to the user message (the job Gemini's
//             responseSchema does for free) and response_format=json_object
//             on the Workers AI side.

import { writeFileSync, mkdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { getDemoPersona, DEMO_PERSONAS } from "../src/lib/demo.ts";
import {
  ROAST_SCHEMA,
  SAFETY,
  buildSystemPrompt,
  buildUserPrompt,
} from "../src/lib/prompt.ts";
import { stripAiDashes } from "../src/lib/gemini.ts";
import { extractSignals } from "../src/lib/signals.ts";
import { brainrotScore } from "../src/lib/score.ts";
import type { RoastReport } from "../src/lib/types.ts";

const OUT_DIR = "docs/superpowers/notes/assets/engine-eval";
const PER_CALL_TIMEOUT_MS = 240_000; // hard per-attempt cap

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith("--only="))?.slice(7) ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const variant = (args.find((a) => a.startsWith("--variant="))?.slice(10) ?? "raw") as "raw" | "jsonfmt";

// The job Gemini's responseSchema does for free.
const JSON_CONTRACT = `

Output format (mandatory, no prose outside the JSON):
Respond with a single JSON object and nothing else, shaped exactly:
{
  "headline": string,
  "roastReport": string (3-5 paragraphs, blank line between paragraphs),
  "brainrotScore": integer,
  "brainrotTier": string,
  "redFlags": array of 4-6 strings,
  "personality": string (2-3 sentences),
  "existentialQuestion": string,
  "channelRoasts": array of { "channel": string, "roast": string }, one per channel listed above,
  "shareCardLine": string (under 120 chars)
}
No markdown fences, no commentary before or after the object.`;

type CallResult =
  | { ok: true; text: string; ms: number; raw: unknown }
  | { ok: false; error: string; ms: number; raw: unknown };

type Candidate = {
  slug: string;
  label: string;
  kind: "gemini" | "workers-ai";
  model: string;
  extraBody?: Record<string, unknown>;
  call: (system: string, user: string, signal: AbortSignal) => Promise<CallResult>;
};

// --- tolerant decode -------------------------------------------------------

// Models wrap JSON in prose, fences, or scribble before it. Find the first
// balanced object and parse that, mirroring the spirit of gemini.ts's
// text-then-JSON.parse flow but surviving markdown fences.
function findBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractText(data: any): string | null {
  const d = data?.data ?? data; // Some shapes nest under .data
  // chat-completions style
  const chat = d?.choices?.[0]?.message?.content ?? d?.choices?.[0]?.message?.reasoning_content;
  if (typeof chat === "string" && chat.trim()) return chat;
  // text-completion style (gpt-oss via --prompt)
  const txt = d?.choices?.[0]?.text ?? d?.response;
  if (typeof txt === "string" && txt.trim()) return txt;
  // Gemini style
  const gem = d?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("");
  if (typeof gem === "string" && gem.trim()) return gem;
  if (typeof d === "string") return d;
  return null;
}

function decodeReport(text: string): { report: RoastReport | null; error: string | null } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [
    text,
    fenced?.[1] ?? "",
    findBalancedJson(text) ?? "",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c) as RoastReport;
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.roastReport === "string" || typeof parsed.headline === "string") {
          return { report: parsed, error: null };
        }
      }
    } catch {
      /* try next shape */
    }
  }
  // A model that returns only a string: wrap it so we can still diff quality.
  const bare = text.replace(/```(?:json)?/g, "").trim();
  if (bare && !bare.startsWith("{")) {
    return {
      report: {
        headline: bare.slice(0, 120),
        roastReport: bare,
        brainrotScore: -1,
        brainrotTier: "(unparsed)",
        redFlags: [],
        personality: "",
        existentialQuestion: "",
        channelRoasts: [],
        shareCardLine: "",
      },
      error: "response was not JSON; wrapped as roastReport only",
    };
  }
  return {
    report: null,
    error: `could not parse JSON from ${text.length} chars of text`,
  };
}

// --- tools (works for both call styles) ------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runCli(model: string, body: Record<string, unknown>, ms: number): Promise<CallResult> {
  const started = Date.now();
  const cliArgs = ["ai", "run", model, "--body", JSON.stringify(body)];
  return await new Promise<CallResult>((resolve) => {
    const child = execFile(
      "cf",
      cliArgs,
      { timeout: ms, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const took = Date.now() - started;
        const out = String(stdout ?? "");
        if (err) {
          resolve({ ok: false, error: `cf cli: ${String(err.message).slice(0, 300)}`, ms: took, raw: out.slice(0, 2000) });
          return;
        }
        try {
          const parsed = JSON.parse(out.slice(out.indexOf("{")));
          // The CLI prints the API envelope; pull the assistant text out of it.
          if (parsed?.success === false) {
            resolve({ ok: false, error: `workers-ai ${model}: ${JSON.stringify(parsed?.errors ?? parsed).slice(0, 300)}`, ms: took, raw: parsed });
            return;
          }
          const text = extractText(parsed) ?? "";
          resolve({ ok: true, text, ms: took, raw: parsed });
        } catch {
          resolve({ ok: false, error: `cf cli returned non-JSON (${out.length} chars)`, ms: took, raw: out.slice(0, 2000) });
        }
      }
    );
  });
}

async function callGemini(system: string, user: string, signal: AbortSignal): Promise<CallResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "GEMINI_API_KEY not set", ms: 0, raw: null };
  // Model id and call shape mirror src/lib/gemini.ts (MODELS array).
  const models = [process.env.GEMINI_MODEL ?? "gemini-3.5-flash", "gemini-flash-lite-latest"];
  const payload = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    safetySettings: SAFETY,
    generationConfig: {
      temperature: 1.0,
      responseMimeType: "application/json",
      responseSchema: ROAST_SCHEMA,
    },
  };
  const started = Date.now();
  let lastErr = "";
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (e) {
      return { ok: false, error: `network: ${String((e as Error).message).slice(0, 200)}`, ms: Date.now() - started, raw: null };
    }
    if (res.ok) {
      const data = await res.json();
      const text = extractText(data);
      return { ok: true, text: text ?? "", ms: Date.now() - started, raw: data };
    }
    lastErr = `gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (res.status === 429 || res.status === 503) {
      await sleep(2000);
      continue; // try next model in MODELS
    }
    break;
  }
  return { ok: false, error: lastErr || "gemini request failed", ms: Date.now() - started, raw: null };
}

// --- candidate registry ----------------------------------------------------

const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const HAS_WORKERS_REST = Boolean(CF_ACCOUNT && CF_TOKEN);

function workersAi(model: string): Candidate["call"] {
  return async (system, user, signal) => {
    if (!HAS_WORKERS_REST) {
      // Fallback path: cached cloudflare CLI auth.
      return runCli(model, { messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 2000 }, PER_CALL_TIMEOUT_MS);
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${model}`;
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${CF_TOKEN}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 6000,
          reasoning_effort: "low",
        }),
        signal,
      });
      const text = await res.text();
      let raw: unknown = text;
      try { raw = JSON.parse(text); } catch { /* keep text */ }
      if (!res.ok) return { ok: false, error: `workers-ai ${model} ${res.status}: ${text.slice(0, 300)}`, ms: Date.now() - started, raw };
      const body = raw as any;
      if (body?.success === false) return { ok: false, error: `workers-ai ${model} api error: ${JSON.stringify(body?.errors ?? body).slice(0, 300)}`, ms: Date.now() - started, raw };
      const t = extractText(body);
      return { ok: true, text: t ?? "", ms: Date.now() - started, raw };
    } catch (e) {
      return { ok: false, error: `network: ${String((e as Error).message).slice(0, 200)}`, ms: Date.now() - started, raw: null };
    }
  };
}

const CANDIDATES: Candidate[] = [
  {
    slug: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash (current)",
    kind: "gemini",
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    call: callGemini,
  },
  {
    slug: "workers-gpt-oss-120b",
    label: "Workers AI @cf/openai/gpt-oss-120b",
    kind: "workers-ai",
    model: "@cf/openai/gpt-oss-120b",
    call: workersAi("@cf/openai/gpt-oss-120b"),
  },
  {
    slug: "workers-qwen3-30b-a3b-fp8",
    label: "Workers AI @cf/qwen/qwen3-30b-a3b-fp8",
    kind: "workers-ai",
    model: "@cf/qwen/qwen3-30b-a3b-fp8",
    call: workersAi("@cf/qwen/qwen3-30b-a3b-fp8"),
  },
  {
    slug: "workers-glm-4.7-flash",
    label: "Workers AI @cf/zai-org/glm-4.7-flash",
    kind: "workers-ai",
    model: "@cf/zai-org/glm-4.7-flash",
    call: workersAi("@cf/zai-org/glm-4.7-flash"),
  },
];

// --- analysis ---------------------------------------------------------------

function countDashes(s: string): number {
  return (s.match(/[—–]/g) ?? []).length;
}

function analyze(report: RoastReport | null): Record<string, unknown> {
  if (!report) return { parsed: false };
  const texts = [
    report.headline,
    report.roastReport,
    report.personality,
    report.existentialQuestion,
    report.shareCardLine,
    ...(report.redFlags ?? []),
    ...(report.channelRoasts ?? []).map((c) => c?.roast ?? ""),
  ].filter((t): t is string => typeof t === "string");
  const joined = texts.join("\n");
  const dashes = texts.map((t) => countDashes(t)).reduce((a, b) => a + b, 0);
  const cleanedDashes = texts.map((t) => countDashes(stripAiDashes(t))).reduce((a, b) => a + b, 0);
  return {
    parsed: true,
    present: {
      headline: typeof report.headline === "string",
      roastReport: typeof report.roastReport === "string",
      redFlags: Array.isArray(report.redFlags) ? report.redFlags.length : null,
      channelRoasts: Array.isArray(report.channelRoasts) ? report.channelRoasts.length : null,
      personality: typeof report.personality === "string",
      existentialQuestion: typeof report.existentialQuestion === "string",
      shareCardLine: typeof report.shareCardLine === "string",
    },
    chars: {
      roastReport: report.roastReport?.length ?? 0,
      headline: report.headline?.length ?? 0,
      total: joined.length,
    },
    paragraphs: (report.roastReport ?? "").split(/\n{2,}/).filter((p) => p.trim()).length,
    emEnDashes: { raw: dashes, afterStrip: cleanedDashes },
    shareCardChars: report.shareCardLine?.length ?? 0,
    modelScore: report.brainrotScore,
    modelTier: report.brainrotTier,
    leaks: {
      literalParagraphLabels: /\bParagraph\s+\d+\s*:/i.test(joined),
      markdownFencesInText: /```/.test(joined),
      bannedPhraseHit: /(delve|tapestry|testament|meticulous|pivotal|crucial|robust|showcase|vibrant|underscore|intricate|journey|realm)\b/i.test(joined),
    },
  };
}

// --- main -------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
const index: Record<string, unknown>[] = [];
const stamp = new Date().toISOString();

console.log(`workers-ai transport: ${HAS_WORKERS_REST ? "REST (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN)" : "cf CLI (cached auth; no env creds)"}`);
console.log(`gemini transport: ${process.env.GEMINI_API_KEY ? "generateContent (GEMINI_API_KEY present)" : "SKIPPED (no GEMINI_API_KEY)"}\n`);

for (const persona of DEMO_PERSONAS) {
  const collected = getDemoPersona(persona);
  if (!collected) throw new Error(`unknown persona ${persona}`);
  const signals = extractSignals(collected.liked, collected.subs, collected.playlistTitles, collected.watchLater);
  const score = brainrotScore(signals);
  const system = buildSystemPrompt();
  const user = buildUserPrompt(signals, score);

  for (const cand of CANDIDATES) {
    if (only.length && !only.includes(cand.slug)) continue;
    const file = join(OUT_DIR, `${cand.slug}-${persona}.json`);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error("timeout")), PER_CALL_TIMEOUT_MS);
    let result: CallResult;
    try {
      result = await cand.call(system, user, ac.signal);
    } catch (e) {
      result = { ok: false, error: `${(e as Error).name}: ${String((e as Error).message).slice(0, 200)}`, ms: 0, raw: null };
    } finally {
      clearTimeout(timer);
    }

    let report: RoastReport | null = null;
    let decodeError: string | null = null;
    let analysis: Record<string, unknown> = { parsed: false };
    if (result.ok) {
      const decoded = decodeReport(result.text);
      report = decoded.report;
      decodeError = decoded.error;
      analysis = analyze(report);
    }

    const errorKind = !result.ok
      ? /timeout|abort/i.test(result.error) ? "timeout" : /401|403|Unauthorized|authentication/i.test(result.error) ? "auth" : "call"
      : decodeError
        ? "parse"
        : null;

    const out = {
      candidate: cand.slug,
      model: cand.model,
      label: cand.label,
      persona,
      stamp,
      durationMs: result.ms,
      call: {
        path: cand.kind === "gemini" ? "gemini-generateContent" : HAS_WORKERS_REST ? "workers-ai-rest" : "cf-cli",
        ok: result.ok,
        error: result.ok ? null : result.error,
      },
      parsed: result.ok ? Boolean(report) : false,
      parseNote: decodeError,
      analysis,
      rawText: result.ok ? result.text : null,
      rawResponse: result.ok ? result.raw : null,
    };
    writeFileSync(file, JSON.stringify(out, null, 2));

    const status = out.parsed ? "OK" : errorKind ? `FAIL(${errorKind})` : "FAIL";
    console.log(
      `${status.padEnd(10)} ${cand.slug.padEnd(28)} ${persona.padEnd(13)} ${result.ms}ms` +
        (out.parsed ? ` report=${(analysis as any).chars?.roastReport ?? 0}c dashes=${(analysis as any).emEnDashes?.raw ?? "?"}` : ` ${(result.ok ? decodeError : result.error)?.slice(0, 120)}`)
    );
    index.push({
      candidate: cand.slug,
      persona,
      parsed: out.parsed,
      errorKind,
      durationMs: result.ms,
      chars: (analysis as any).chars?.roastReport ?? 0,
      dashes: (analysis as any).emEnDashes?.raw ?? null,
      file,
    });
  }
}

writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify({ stamp, results: index }, null, 2));
console.log(`\nwrote ${index.length} result files + index.json to ${OUT_DIR}/`);
