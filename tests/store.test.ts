import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import {
  deleteReport,
  getReport,
  listReports,
  saveReport,
} from "../src/lib/store.ts";
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

const dir = join(process.cwd(), "data", "reports");

before(async () => {
  await rm(dir, { recursive: true, force: true });
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("saveReport returns 8-char id and getReport round-trips", async () => {
  const id = await saveReport(report, signals, score, "demo");
  assert.match(id, /^[a-z0-9]{8}$/);
  const got = await getReport(id);
  assert.ok(got);
  assert.equal(got.report.headline, "h");
  assert.equal(got.source, "demo");
  assert.ok(got.createdAt);
});

test("getReport rejects bad ids and missing files", async () => {
  assert.equal(await getReport("../etc/passwd"), null);
  assert.equal(await getReport("zzzzzzzz"), null);
});

test("listReports sorts newest first and respects limit", async () => {
  for (let i = 0; i < 3; i++) await saveReport(report, signals, score, "youtube");
  const all = await listReports();
  assert.equal(all.length, 4);
  assert.ok(all[0].createdAt >= all[1].createdAt);
  assert.equal((await listReports(2)).length, 2);
});

test("deleteReport removes and refuses bad ids", async () => {
  const id = await saveReport(report, signals, score, "demo");
  assert.equal(await deleteReport(id), true);
  assert.equal(await getReport(id), null);
  assert.equal(await deleteReport("no"), false);
});
