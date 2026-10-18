import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoPersona } from "@/lib/demo";
import { extractSignals } from "@/lib/signals";
import { brainrotScore } from "@/lib/score";
import { roast } from "@/lib/gemini";
import { getReport, saveReport } from "@/lib/store";
import { collect, QuotaError } from "@/lib/youtube";
import { getKv } from "@/lib/kv";
import {
  cacheDemoReportId,
  consumeBudget,
  dailyBudgetCap,
  getCachedDemoReportId,
  ipRateLimited,
} from "@/lib/limits";
import { verifyTurnstile } from "@/lib/turnstile";
import { SESSION_COOKIE, openSession } from "@/lib/oauth";

// collect() wraps upstream failures as `YouTube API <status> (<reason>): ...`
// (youtube.ts): recover the numeric status for structured logs, and treat a
// 401 as a rejected/expired token even though the sealed session was valid.
function youtubeUpstreamStatus(e: unknown): number | null {
  if (!(e instanceof Error)) return null;
  const m = /^YouTube API (\d{3})\b/.exec(e.message);
  return m ? Number(m[1]) : null;
}

// gemini.ts throws `Gemini <model> <status>: ...` for non-OK responses.
function geminiUpstreamStatus(e: unknown): number | null {
  if (!(e instanceof Error)) return null;
  const m = /^Gemini \S+ (\d{3}):/.exec(e.message);
  return m ? Number(m[1]) : null;
}

// Admission order: rate limit → parse → (demo: Turnstile → cache) →
// (youtube: session) → daily budget → collect → generate. Cache hits are free;
// admitted-but-failed generations keep their budget unit (soft limit).
// Rejection/success logs are structured and carry no PII: no titles, ids,
// IPs, tokens, or upstream response text.
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const ip =
    req.headers.get("cf-connecting-ip") ??
    // XFF fallback: take the LAST element. On Cloudflare the edge overwrites/
    // appends the real client IP at the end of the chain, so earlier entries
    // are client-controlled spoofing bait; the last one is the one we saw.
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    "local";
  const kv = await getKv();
  if (await ipRateLimited(kv, ip, Date.now())) {
    // Pre-parse by design, so the source is not known at this point.
    console.warn({ evt: "reject", code: "rate_limited", source: "unknown" });
    return NextResponse.json(
      { error: "rate_limited", message: "3 roasts per hour. Breathe. Try again later." },
      { status: 429 }
    );
  }

  let body: { source?: string; persona?: string; turnstileToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  let demo: ReturnType<typeof getDemoPersona> = null;
  let youtubeToken: string | undefined;

  if (body.source === "demo") {
    demo = getDemoPersona(body.persona ?? "");
    if (!demo) {
      return NextResponse.json(
        { error: "unknown_persona", message: "Try lurker, gremlin, or essay-hoarder." },
        { status: 400 }
      );
    }
    const human = await verifyTurnstile({
      secret: process.env.TURNSTILE_SECRET_KEY,
      token: body.turnstileToken,
      remoteIp: ip,
    });
    if (!human) {
      console.warn({ evt: "reject", code: "turnstile_failed", source: "demo" });
      return NextResponse.json(
        { error: "turnstile_failed", message: "Bot check failed. Reload the page and try again." },
        { status: 403 }
      );
    }
    const cachedId = await getCachedDemoReportId(kv, body.persona ?? "");
    if (cachedId) {
      const stored = await getReport(cachedId);
      if (stored) {
        console.log({
          evt: "roast",
          source: "demo",
          outcome: "ok",
          ms: Date.now() - startedAt,
        });
        return NextResponse.json({
          id: stored.id,
          report: stored.report,
          signals: stored.signals,
          score: stored.score,
          persona: stored.persona,
        });
      }
    }
  } else if (body.source === "youtube") {
    const jar = await cookies();
    const sid = jar.get(SESSION_COOKIE)?.value;
    const session = sid ? await openSession(sid) : null;
    if (!session) {
      return NextResponse.json(
        { error: "not_signed_in", message: "Sign in with Google first." },
        { status: 401 }
      );
    }
    youtubeToken = session.token;
  } else {
    return NextResponse.json(
      { error: "bad_source", message: 'Use {source:"demo",persona} or {source:"youtube"}.' },
      { status: 400 }
    );
  }

  if (!(await consumeBudget(kv, Date.now(), dailyBudgetCap()))) {
    console.warn({ evt: "reject", code: "budget_exhausted", source: body.source });
    return NextResponse.json(
      {
        error: "budget_exhausted",
        message: "The court has heard enough cases today. Come back tomorrow.",
      },
      { status: 429 }
    );
  }

  let collected;
  let source: "demo" | "youtube";
  let persona: string | undefined;

  if (body.source === "demo") {
    collected = demo!;
    source = "demo";
    persona = body.persona;
  } else {
    try {
      collected = await collect(youtubeToken!);
    } catch (e) {
      if (e instanceof QuotaError) {
        console.warn({ evt: "reject", code: "quota_exhausted", source: "youtube" });
        return NextResponse.json({ error: "quota_exhausted", message: e.message }, { status: 429 });
      }
      const status = youtubeUpstreamStatus(e);
      if (status === 401) {
        // The sealed session was still valid; Google rejected the token.
        console.warn({ evt: "reject", code: "reauth", source: "youtube", status });
        return NextResponse.json(
          {
            error: "reauth",
            message: "Your Google session went stale. Sign in again and the court will resume.",
          },
          { status: 401 }
        );
      }
      console.warn({
        evt: "reject",
        code: "youtube_failed",
        source: "youtube",
        ...(status !== null ? { status } : {}),
      });
      return NextResponse.json(
        {
          error: "youtube_failed",
          message: "YouTube did not answer for your account. Try again in a minute.",
        },
        { status: 502 }
      );
    }
    source = "youtube";
  }

  const signals = extractSignals(
    collected.liked,
    collected.subs,
    collected.playlistTitles,
    collected.watchLater
  );
  const score = brainrotScore(signals);

  let report;
  try {
    report = await roast(signals, score);
  } catch (e) {
    const status = geminiUpstreamStatus(e);
    console.warn({
      evt: "reject",
      code: "gemini_failed",
      source,
      ...(status !== null ? { status } : {}),
    });
    return NextResponse.json(
      {
        error: "gemini_failed",
        message:
          "The roast engine is oversubscribed right now. Give it a minute and demand a retrial.",
      },
      { status: 503 }
    );
  }

  const id = await saveReport(report, signals, score, source, persona);
  if (source === "demo" && persona) {
    await cacheDemoReportId(kv, persona, id);
  }
  console.log({ evt: "roast", source, outcome: "ok", ms: Date.now() - startedAt });
  return NextResponse.json({ id, report, signals, score, persona });
}
