import test from "node:test";
import assert from "node:assert/strict";
import { brainrotScore, tierFor, WEIGHTS } from "../src/lib/score.ts";
import type { Signals } from "../src/lib/types.ts";

const base: Signals = {
  totalLikes: 0,
  likesLast7d: 0,
  likesPerDay: 0,
  shortsRatio: 0,
  avgVideoLengthSec: 0,
  longestVideoSec: 0,
  longestVideoTitle: "",
  topicEntropy: 0,
  categories: {},
  parasocialRatio: 0,
  selfImprovementCount: 0,
  ragebaitCount: 0,
  procrastinationCount: 0,
  watchLaterCount: 0,
  playlistTitles: [],
  topChannels: [],
  likeBursts: [],
  subsVsLikes: 0,
  nicheContradictions: [],
  topChannelTitles: [],
  sampleTitles: [],
  lateNightCount: 0,
};

const s = (over: Partial<Signals>): Signals => ({ ...base, ...over });

test("all-zero signals -> score 0, Well Adjusted", () => {
  const r = brainrotScore(base);
  assert.equal(r.score, 0);
  assert.equal(r.tier, "Well Adjusted");
});

test("worst-case signals -> score 100, Please Go Outside", () => {
  const r = brainrotScore(
    s({
      totalLikes: 200,
      likesPerDay: 40,
      shortsRatio: 1,
      avgVideoLengthSec: 30,
      topicEntropy: 1,
      ragebaitCount: 200,
      selfImprovementCount: 99,
      watchLaterCount: 999,
    })
  );
  assert.equal(r.score, 100);
  assert.equal(r.tier, "Please Go Outside");
});

test("breakdown sums to score within rounding", () => {
  const r = brainrotScore(
    s({
      totalLikes: 37,
      likesPerDay: 5.3,
      shortsRatio: 0.62,
      avgVideoLengthSec: 412,
      topicEntropy: 0.71,
      ragebaitCount: 9,
      selfImprovementCount: 6,
      watchLaterCount: 17,
    })
  );
  const sum = r.breakdown.reduce((a, b) => a + b.points, 0);
  assert.ok(Math.abs(sum - r.score) <= 1, `${sum} vs ${r.score}`);
  assert.equal(r.breakdown.length, Object.keys(WEIGHTS).length);
});

test("tier boundaries at 20 / 40 / 60 / 80", () => {
  assert.equal(brainrotScore(s({ shortsRatio: 0.8 })).score, 20);
  assert.equal(brainrotScore(s({ shortsRatio: 0.8 })).tier, "Well Adjusted");

  assert.equal(brainrotScore(s({ shortsRatio: 0.8, likesPerDay: 12 })).score, 40);
  assert.equal(brainrotScore(s({ shortsRatio: 0.8, likesPerDay: 12 })).tier, "Mildly Concerning");

  assert.equal(brainrotScore(s({ shortsRatio: 1, likesPerDay: 12, totalLikes: 10, ragebaitCount: 10 })).score, 60);
  assert.equal(
    brainrotScore(s({ shortsRatio: 1, likesPerDay: 12, totalLikes: 10, ragebaitCount: 10 })).tier,
    "Unhinged"
  );

  const eighty = s({
    shortsRatio: 1,
    likesPerDay: 12,
    totalLikes: 10,
    ragebaitCount: 10,
    topicEntropy: 1,
    selfImprovementCount: 15,
    watchLaterCount: 20,
  });
  assert.equal(brainrotScore(eighty).score, 80);
  assert.equal(brainrotScore(eighty).tier, "Terminal");

  assert.equal(tierFor(81), "Please Go Outside");
});

test("sub-scores clamp: absurd values cannot exceed the weight", () => {
  const r = brainrotScore(
    s({ likesPerDay: 9999, shortsRatio: 5, topicEntropy: 9, selfImprovementCount: 1e6, watchLaterCount: 1e6 })
  );
  const byFactor = Object.fromEntries(r.breakdown.map((b) => [b.factor, b.points]));
  assert.equal(byFactor.velocity, WEIGHTS.velocity);
  assert.equal(byFactor.shortsRatio, WEIGHTS.shortsRatio);
  assert.equal(byFactor.entropy, WEIGHTS.entropy);
  assert.equal(byFactor.selfImprovement, WEIGHTS.selfImprovement);
  assert.equal(byFactor.watchLater, WEIGHTS.watchLater);
});

test("long-form watchers get no length penalty", () => {
  const r = brainrotScore(s({ avgVideoLengthSec: 3600 }));
  const length = r.breakdown.find((b) => b.factor === "length");
  assert.equal(length?.points, 0);
});

test("NaN signals do not poison the score", () => {
  const r = brainrotScore(s({ likesPerDay: NaN, shortsRatio: NaN, topicEntropy: NaN }));
  assert.equal(r.score, 0);
  assert.equal(r.tier, "Well Adjusted");
});
