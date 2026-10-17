import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROAST_SCHEMA,
  SAFETY,
  buildSystemPrompt,
  buildUserPrompt,
} from "../src/lib/prompt.ts";
import type { Signals } from "../src/lib/types.ts";

const signals: Signals = {
  totalLikes: 1200,
  likesLast7d: 300,
  likesPerDay: 17.1,
  shortsRatio: 0.62,
  avgVideoLengthSec: 420,
  longestVideoSec: 14400,
  longestVideoTitle: "THE ENTIRE HISTORY OF ROME (8 HOURS)",
  topicEntropy: 0.71,
  categories: { techHaul: 90, shorts: 300, ragebait: 40 },
  parasocialRatio: 0.4,
  selfImprovementCount: 61,
  ragebaitCount: 40,
  procrastinationCount: 12,
  watchLaterCount: 311,
  playlistTitles: ["Watch Later", "Someday (lies)"],
  topChannels: [
    { name: "Linus Tech Tips", likes: 210 },
    { name: "Huberman Lab", likes: 95 },
    { name: "SomeRageBaitChannel", likes: 80 },
  ],
  likeBursts: [{ date: "2026-10-03", count: 64 }],
  subsVsLikes: 0.02,
  nicheContradictions: ["minimalism vs tech hauls"],
  topChannelTitles: ["I BOUGHT THE WORST PC ON EBAY", "This 4-hour protocol fixes sleep"],
  sampleTitles: ["I BOUGHT THE WORST PC ON EBAY", "POV: 3AM doomscroll"],
  lateNightCount: 140,
};

test("buildUserPrompt contains every top channel name", () => {
  const out = buildUserPrompt(signals, { score: 74, tier: "Terminal" });
  for (const c of signals.topChannels) {
    assert.ok(out.includes(c.name), `missing channel: ${c.name}`);
  }
});

test("buildUserPrompt contains score and tier", () => {
  const out = buildUserPrompt(signals, { score: 74, tier: "Terminal" });
  assert.ok(out.includes("74"));
  assert.ok(out.includes("Terminal"));
});

test("buildUserPrompt contains each niche contradiction", () => {
  const out = buildUserPrompt(signals, { score: 74, tier: "Terminal" });
  for (const c of signals.nicheContradictions) {
    assert.ok(out.includes(c), `missing contradiction: ${c}`);
  }
});

test("buildUserPrompt contains sample titles", () => {
  const out = buildUserPrompt(signals, { score: 74, tier: "Terminal" });
  for (const t of signals.sampleTitles) {
    assert.ok(out.includes(t), `missing title: ${t}`);
  }
});

test("system prompt forbids invention and advice", () => {
  const sys = buildSystemPrompt();
  assert.ok(sys.toLowerCase().includes("never invent"));
  assert.ok(sys.toLowerCase().includes("no advice"));
});

test("system prompt carries the humanizer rules", () => {
  const sys = buildSystemPrompt();
  assert.ok(sys.includes("no em dashes"));
  assert.ok(sys.toLowerCase().includes("banned constructions"));
  assert.ok(sys.toLowerCase().includes("banned words"));
});

test("ROAST_SCHEMA requires all 9 report fields", () => {
  assert.equal(ROAST_SCHEMA.required.length, 9);
  for (const f of [
    "headline",
    "roastReport",
    "brainrotScore",
    "brainrotTier",
    "redFlags",
    "personality",
    "existentialQuestion",
    "channelRoasts",
    "shareCardLine",
  ]) {
    assert.ok(ROAST_SCHEMA.required.includes(f), `missing field: ${f}`);
    assert.ok((ROAST_SCHEMA.properties as Record<string, unknown>)[f], `missing property: ${f}`);
  }
});

test("SAFETY lowers harassment and hate thresholds", () => {
  const byCat = Object.fromEntries(
    SAFETY.map((s) => [s.category, s.threshold])
  );
  assert.equal(byCat.HARM_CATEGORY_HARASSMENT, "BLOCK_ONLY_HIGH");
  assert.equal(byCat.HARM_CATEGORY_HATE_SPEECH, "BLOCK_ONLY_HIGH");
});
