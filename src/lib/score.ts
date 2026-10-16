import type { ScoreResult, Signals } from "./types.ts";

export const WEIGHTS = {
  shortsRatio: 25,
  velocity: 20,
  length: 15,
  ragebait: 15,
  selfImprovement: 10,
  watchLater: 10,
  entropy: 5,
} as const;

export type Tier =
  | "Well Adjusted"
  | "Mildly Concerning"
  | "Unhinged"
  | "Terminal"
  | "Please Go Outside";

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export function tierFor(score: number): Tier {
  if (score <= 20) return "Well Adjusted";
  if (score <= 40) return "Mildly Concerning";
  if (score <= 60) return "Unhinged";
  if (score <= 80) return "Terminal";
  return "Please Go Outside";
}

export function brainrotScore(s: Signals): ScoreResult {
  const subs = {
    shortsRatio: clamp01(s.shortsRatio),
    velocity: clamp01(s.likesPerDay / 12),
    length: clamp01(s.avgVideoLengthSec > 0 ? 1 - Math.min(1, s.avgVideoLengthSec / 1800) : 0),
    ragebait: clamp01(s.totalLikes ? s.ragebaitCount / s.totalLikes : 0),
    selfImprovement: clamp01(s.selfImprovementCount / 15),
    watchLater: clamp01(s.watchLaterCount / 40),
    entropy: clamp01(s.topicEntropy),
  };

  const breakdown = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((factor) => ({
    factor,
    points: Math.round(subs[factor] * WEIGHTS[factor]),
  }));

  const score = Math.min(100, Math.max(0, breakdown.reduce((a, b) => a + b.points, 0)));
  return { score, tier: tierFor(score), breakdown };
}
