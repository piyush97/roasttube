// Abuse-limit primitives for POST /api/roast. Pure over a KvLike: production
// passes the ROASTTUBE_KV binding, tests and local dev pass MapKv.
import type { KvLike } from "./kv.ts";

export const RATE_LIMIT_PER_HOUR = 3;
export const DAILY_BUDGET_DEFAULT = 15;

const HOUR_MS = 3_600_000;
const DAY_SECONDS = 24 * 3600;
const DEMO_CACHE_PREFIX = "demo-cache:";
const DEMO_CACHE_TTL_SECONDS = 3600;

type RateValue = { n: number; reset: number };

function parseJson<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// true = over the limit, reject. Rejected requests never write, so hammering
// cannot extend the window; it rolls over at the stored reset time.
export async function ipRateLimited(
  kv: KvLike,
  ip: string,
  now: number,
  limit = RATE_LIMIT_PER_HOUR,
  windowMs = HOUR_MS
): Promise<boolean> {
  const key = `rl:${ip}`;
  const current = parseJson<RateValue>(await kv.get(key));
  if (
    current &&
    Number.isFinite(current.n) &&
    Number.isFinite(current.reset) &&
    now < current.reset
  ) {
    if (current.n >= limit) return true;
    await kv.put(key, JSON.stringify({ n: current.n + 1, reset: current.reset }), {
      expirationTtl: Math.ceil((current.reset - now) / 1000) + 60,
    });
    return false;
  }
  await kv.put(key, JSON.stringify({ n: 1, reset: now + windowMs }), {
    expirationTtl: Math.ceil(windowMs / 1000) + 60,
  });
  return false;
}

// true = admitted, one unit consumed. The read-then-write pair can overshoot
// by one under concurrent requests; accepted (soft limit; the 15-vs-20 margin
// on the free Gemini tier covers it).
export async function consumeBudget(kv: KvLike, now: number, cap: number): Promise<boolean> {
  const key = `budget:${new Date(now).toISOString().slice(0, 10)}`;
  const parsed = Number(await kv.get(key));
  const used = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  if (used >= cap) return false;
  await kv.put(key, String(used + 1), { expirationTtl: 2 * DAY_SECONDS });
  return true;
}

export async function getCachedDemoReportId(
  kv: KvLike,
  persona: string
): Promise<string | null> {
  return kv.get(DEMO_CACHE_PREFIX + persona);
}

export async function cacheDemoReportId(
  kv: KvLike,
  persona: string,
  id: string
): Promise<void> {
  await kv.put(DEMO_CACHE_PREFIX + persona, id, { expirationTtl: DEMO_CACHE_TTL_SECONDS });
}

export function dailyBudgetCap(env: Record<string, string | undefined> = process.env): number {
  const parsed = Number.parseInt(env.DAILY_ROAST_BUDGET ?? "", 10);
  if (!Number.isFinite(parsed)) return DAILY_BUDGET_DEFAULT;
  return Math.max(1, parsed);
}
