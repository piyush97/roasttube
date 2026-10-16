import test from "node:test";
import assert from "node:assert/strict";
import { classify, BUCKETS } from "../src/lib/categories.ts";

test("waking up at 5am is self improvement", () => {
  const b = classify("I Tried Waking Up at 5AM for 30 Days", "Improvement Pill", "Education");
  assert.ok(b.includes("selfImprovement"), JSON.stringify(b));
});

test("procrastination video is procrastination", () => {
  const b = classify("I Procrastinated Watching This For 9 Hours", "Some Guy", "Entertainment");
  assert.ok(b.includes("procrastination"), JSON.stringify(b));
});

test("drama reaction is ragebait", () => {
  const b = classify("Reacting to the Most Cringe Drama of 2026", "DramaChannel", "Entertainment");
  assert.ok(b.includes("ragebait"), JSON.stringify(b));
});

test("shorts marker is shortsCulture", () => {
  const b = classify("cat falls over #shorts", "CatFails", "Pets & Animals");
  assert.ok(b.includes("shortsCulture"), JSON.stringify(b));
});

test("channel name can carry the bucket", () => {
  const b = classify("Episode 47", "Midnight Podcast", "Film & Animation");
  assert.ok(b.includes("parasocial"), JSON.stringify(b));
});

test("unknown input returns empty", () => {
  assert.deepEqual(classify("Q47", "X", ""), []);
});

test("buckets are lowercase substring lists", () => {
  for (const [name, terms] of Object.entries(BUCKETS)) {
    assert.ok(Array.isArray(terms) && terms.length > 0, name);
    for (const t of terms) assert.equal(t, t.toLowerCase(), `${name}: ${t}`);
  }
});
