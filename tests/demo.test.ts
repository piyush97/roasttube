import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_PERSONAS, getDemoPersona } from "../src/lib/demo.ts";
import { extractSignals } from "../src/lib/signals.ts";
import { brainrotScore } from "../src/lib/score.ts";

test("unknown persona returns null", () => {
  assert.equal(getDemoPersona("nope"), null);
});

test("all personas produce signals and a score", () => {
  for (const name of DEMO_PERSONAS) {
    const c = getDemoPersona(name);
    assert.ok(c, name);
    const s = extractSignals(c.liked, c.subs, c.playlistTitles, c.watchLater);
    const score = brainrotScore(s);
    assert.ok(s.totalLikes > 0, `${name} likes`);
    assert.ok(score.score >= 0 && score.score <= 100, `${name} score`);
  }
});

test("lurker: high subs vs likes, big watch later", () => {
  const c = getDemoPersona("lurker")!;
  const s = extractSignals(c.liked, c.subs, c.playlistTitles, c.watchLater);
  assert.equal(s.totalLikes, 11);
  assert.equal(s.watchLaterCount, 212);
  assert.ok(s.subsVsLikes > 20);
});

test("gremlin: 92% shorts, heavy 7d velocity", () => {
  const c = getDemoPersona("gremlin")!;
  const s = extractSignals(c.liked, c.subs, c.playlistTitles, c.watchLater);
  assert.ok(s.shortsRatio > 0.85);
  assert.ok(s.likesLast7d > 200);
});

test("essay-hoarder: 4h11m longest, minimalism vs tech haul contradiction", () => {
  const c = getDemoPersona("essay-hoarder")!;
  const s = extractSignals(c.liked, c.subs, c.playlistTitles, c.watchLater);
  assert.equal(s.longestVideoSec, 15082);
  assert.ok(s.nicheContradictions.length > 0);
});
