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

// Admission order: rate limit → parse → (demo: Turnstile → cache) →
// (youtube: session) → daily budget → collect → generate. Cache hits are free;
// admitted-but-failed generations keep their budget unit (soft limit).
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const kv = await getKv();
  if (await ipRateLimited(kv, ip, Date.now())) {
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
      return NextResponse.json(
        { error: "turnstile_failed", message: "Bot check failed. Reload the page and try again." },
        { status: 403 }
      );
    }
    const cachedId = await getCachedDemoReportId(kv, body.persona ?? "");
    if (cachedId) {
      const stored = await getReport(cachedId);
      if (stored) {
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
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof QuotaError) {
        return NextResponse.json({ error: "quota_exhausted", message: msg }, { status: 429 });
      }
      return NextResponse.json({ error: "youtube_failed", message: msg }, { status: 502 });
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
    return NextResponse.json(
      { error: "gemini_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  const id = await saveReport(report, signals, score, source, persona);
  if (source === "demo" && persona) {
    await cacheDemoReportId(kv, persona, id);
  }
  return NextResponse.json({ id, report, signals, score, persona });
}
