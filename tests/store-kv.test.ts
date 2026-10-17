import { test } from "node:test";
import assert from "node:assert/strict";
import { MapKv } from "../src/lib/kv.ts";
import { createKvStore } from "../src/lib/store-kv.ts";
import type { RoastReport, ScoreResult, Signals } from "../src/lib/types.ts";

const report: RoastReport = {
  headline: "h",
  roastReport: "r",
  brainrotScore: 42,
  brainrotTier: "Unhinged",
  redFlags: ["a"],
  personality: "p",
  existentialQuestion: "q?",
  channelRoasts: [{ channel: "c", roast: "x" }],
  shareCardLine: "s",
};
const signals = {} as Signals;
const score: ScoreResult = { score: 42, tier: "Unhinged", breakdown: [] };

function freshStore() {
  return createKvStore(new MapKv());
}

test("saveReport returns an 8-char id and getReport round-trips", async () => {
  const store = freshStore();
  const id = await store.saveReport(report, signals, score, "demo", "marathon-mike");
  assert.match(id, /^[a-z0-9]{8}$/);
  const got = await store.getReport(id);
  assert.ok(got);
  assert.equal(got.id, id);
  assert.equal(got.report.headline, "h");
  assert.equal(got.source, "demo");
  assert.equal(got.persona, "marathon-mike");
  assert.ok(got.createdAt);
  assert.equal((await store.getReport(id))?.signals["totalLikes" as keyof Signals], undefined);
});

test("getReport rejects malformed and unknown ids", async () => {
  const store = freshStore();
  assert.equal(await store.getReport("../etc/passwd"), null);
  assert.equal(await store.getReport("zzzzzzzz"), null);
});

test("getReport returns null for corrupt stored JSON", async () => {
  const kv = new MapKv();
  await kv.put("report:aaaaaaaa", "not json");
  const store = createKvStore(kv);
  assert.equal(await store.getReport("aaaaaaaa"), null);
});

test("listReports returns newest first, respects limit, drops corrupt entries", async () => {
  const kv = new MapKv();
  const store = createKvStore(kv);
  for (let i = 0; i < 3; i++) await store.saveReport(report, signals, score, "youtube");
  await kv.put("report:badjson1", "nope");
  const all = await store.listReports();
  assert.equal(all.length, 3);
  assert.ok(all[0].createdAt >= all[1].createdAt);
  assert.equal((await store.listReports(2)).length, 2);
});

test("deleteReport removes the key and refuses bad ids", async () => {
  const store = freshStore();
  const id = await store.saveReport(report, signals, score, "demo");
  assert.equal(await store.deleteReport(id), true);
  assert.equal(await store.getReport(id), null);
  assert.equal(await store.deleteReport("no"), false);
});
