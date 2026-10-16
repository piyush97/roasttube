import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoPersona } from "@/lib/demo";
import { extractSignals } from "@/lib/signals";
import { brainrotScore } from "@/lib/score";
import { roast } from "@/lib/gemini";
import { saveReport } from "@/lib/store";
import { collect, QuotaError } from "@/lib/youtube";
import { SESSION_COOKIE, getSession } from "@/lib/oauth";

// 3 roasts per hour per IP, in-memory. Good enough for localhost + testing mode.
const hits = new Map<string, number[]>();
const WINDOW = 3_600_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (list.length >= 3) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.nextUrl.searchParams.get("ip") ||
    "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "rate_limited", message: "3 roasts per hour. Breathe. Try again later." },
      { status: 429 }
    );
  }

  let body: { source?: string; persona?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  let collected;
  let source: "demo" | "youtube";
  let persona: string | undefined;

  if (body.source === "demo") {
    const p = getDemoPersona(body.persona ?? "");
    if (!p) {
      return NextResponse.json(
        { error: "unknown_persona", message: "Try lurker, gremlin, or essay-hoarder." },
        { status: 400 }
      );
    }
    collected = p;
    source = "demo";
    persona = body.persona;
  } else if (body.source === "youtube") {
    const jar = await cookies();
    const sid = jar.get(SESSION_COOKIE)?.value;
    const sess = sid ? getSession(sid) : undefined;
    if (!sess) {
      return NextResponse.json(
        { error: "not_signed_in", message: "Sign in with Google first." },
        { status: 401 }
      );
    }
    try {
      collected = await collect(sess.token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof QuotaError) {
        return NextResponse.json({ error: "quota_exhausted", message: msg }, { status: 429 });
      }
      return NextResponse.json({ error: "youtube_failed", message: msg }, { status: 502 });
    }
    source = "youtube";
  } else {
    return NextResponse.json(
      { error: "bad_source", message: 'Use {source:"demo",persona} or {source:"youtube"}.' },
      { status: 400 }
    );
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

  const id = await saveReport(report, signals, score, source);
  return NextResponse.json({ id, report, signals, score, persona });
}
