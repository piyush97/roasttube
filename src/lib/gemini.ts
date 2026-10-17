import type { RoastReport, ScoreResult, Signals } from "./types.ts";
import { ROAST_SCHEMA, SAFETY, buildSystemPrompt, buildUserPrompt } from "./prompt.ts";

// gemini-2.5-flash is retired for new API keys (404). Free-tier quota on the
// flash family is tiny (~20/day); lite-latest has its own pool, so fall back.
const MODELS = [process.env.GEMINI_MODEL ?? "gemini-3.5-flash", "gemini-flash-lite-latest"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gemini sometimes writes literal "Paragraph 2:" labels inline instead of
// paragraph breaks. Convert them to real breaks so the tabloid columns render.
export function normalizeParagraphs(text: string): string {
  return text
    .replace(/\s*\bParagraph\s+\d+\s*:\s*/gi, "\n\n")
    .replace(/([^\n])\n(?!\n)/g, "$1\n\n") // single newline = intended paragraph break
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Em/en dashes are the strongest AI-writing tell. Swap them for commas or a
// sentence break; number ranges keep a plain hyphen. Prompt rules ask the
// model to avoid them already, this guarantees it.
export function stripAiDashes(text: string): string {
  return text.replace(
    /[ \t]*[—–][ \t]*/g,
    (_m: string, offset: number, whole: string) => {
      const before = whole.slice(0, offset).replace(/[ \t]+$/, "").at(-1) ?? "";
      const after = whole[offset + _m.length] ?? "";
      if (before === "" || before === "\n") return "";
      if (/[0-9]/.test(before) && /[0-9]/.test(after)) return "-";
      if (/[.!?]/.test(before)) return " ";
      return /\p{Lu}/u.test(after) ? ". " : ", ";
    }
  );
}

function cleanOne(text: string): string {
  return stripAiDashes(normalizeParagraphs(text));
}

export async function roast(
  s: Signals,
  r: ScoreResult
): Promise<RoastReport> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const payload = {
    systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
    contents: [{ role: "user", parts: [{ text: buildUserPrompt(s, r) }] }],
    // safetySettings is top-level; inside generationConfig it 400s.
    safetySettings: SAFETY,
    generationConfig: {
      temperature: 1.0,
      responseMimeType: "application/json",
      responseSchema: ROAST_SCHEMA,
    },
  };

  let res: Response | undefined;
  let lastErr = "";
  for (const model of MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
      });
      if (res.ok) break;
      lastErr = `Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;
      // 429/503 = quota or capacity; retry once, then try next model.
      if (res.status === 429 || res.status === 503) {
        if (attempt === 0) await sleep(1500);
        continue;
      }
      throw new Error(lastErr); // 4xx other than quota: no point retrying
    }
    if (res?.ok) break;
  }
  if (!res?.ok) throw new Error(lastErr || "Gemini request failed");

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blocked = data?.promptFeedback?.blockReason;
    throw new Error(
      blocked
        ? `Gemini blocked the request (reason: ${blocked})`
        : "Gemini returned an empty response"
    );
  }

  const report = JSON.parse(text) as RoastReport;
  report.headline = cleanOne(report.headline);
  report.roastReport = cleanOne(report.roastReport);
  report.redFlags = report.redFlags.map(cleanOne);
  report.personality = cleanOne(report.personality);
  report.existentialQuestion = cleanOne(report.existentialQuestion);
  report.shareCardLine = cleanOne(report.shareCardLine);
  report.channelRoasts = report.channelRoasts.map((c) => ({
    ...c,
    roast: cleanOne(c.roast),
  }));
  // Hard-compute wins over model self-report.
  report.brainrotScore = r.score;
  report.brainrotTier = r.tier;
  return report;
}
