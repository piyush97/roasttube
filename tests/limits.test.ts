import { test } from "node:test";
import assert from "node:assert/strict";
import { MapKv } from "../src/lib/kv.ts";
import {
  RATE_LIMIT_PER_HOUR,
  DAILY_BUDGET_DEFAULT,
  cacheDemoReportId,
  consumeBudget,
  dailyBudgetCap,
  getCachedDemoReportId,
  ipRateLimited,
} from "../src/lib/limits.ts";

test(`rate limit allows ${RATE_LIMIT_PER_HOUR} per hour then rejects`, async () => {
  const kv = new MapKv();
  const t = 1_000_000_000;
  for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
    assert.equal(await ipRateLimited(kv, "1.2.3.4", t + i * 1000), false, `call ${i + 1}`);
  }
  assert.equal(await ipRateLimited(kv, "1.2.3.4", t + 3_000), true);
});

test("rate limit is per IP and per window", async () => {
  const kv = new MapKv();
  const t = 1_000_000_000;
  for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) await ipRateLimited(kv, "a", t);
  assert.equal(await ipRateLimited(kv, "a", t + 1000), true);
  assert.equal(await ipRateLimited(kv, "b", t + 1000), false);
  // a new window starts once the stored reset passes
  assert.equal(await ipRateLimited(kv, "a", t + 3_600_001), false);
});

test("rejected requests never extend the window", async () => {
  const kv = new MapKv();
  const t = 1_000_000_000;
  for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) await ipRateLimited(kv, "ip", t);
  assert.equal(await ipRateLimited(kv, "ip", t + 3_500_000), true);
  assert.equal(await ipRateLimited(kv, "ip", t + 3_600_001), false);
});

test("budget admits the cap then rejects", async () => {
  const kv = new MapKv();
  const t = Date.UTC(2026, 9, 17, 12, 0, 0);
  assert.equal(await consumeBudget(kv, t, 2), true);
  assert.equal(await consumeBudget(kv, t + 1000, 2), true);
  assert.equal(await consumeBudget(kv, t + 2000, 2), false);
});

test("budget resets on the next UTC day", async () => {
  const kv = new MapKv();
  const t = Date.UTC(2026, 9, 17, 23, 59, 0);
  assert.equal(await consumeBudget(kv, t, 1), true);
  assert.equal(await consumeBudget(kv, t + 30_000, 1), false);
  assert.equal(await consumeBudget(kv, t + 120_000, 1), true);
});

test("a corrupt budget value counts as zero", async () => {
  const kv = new MapKv();
  const t = Date.UTC(2026, 9, 17);
  await kv.put(`budget:${new Date(t).toISOString().slice(0, 10)}`, "junk");
  assert.equal(await consumeBudget(kv, t, 1), true);
});

test("dailyBudgetCap parses, defaults, and clamps to at least 1", () => {
  assert.equal(dailyBudgetCap({}), DAILY_BUDGET_DEFAULT);
  assert.equal(dailyBudgetCap({ DAILY_ROAST_BUDGET: "7" }), 7);
  assert.equal(dailyBudgetCap({ DAILY_ROAST_BUDGET: "0" }), 1);
  assert.equal(dailyBudgetCap({ DAILY_ROAST_BUDGET: "-3" }), 1);
  assert.equal(dailyBudgetCap({ DAILY_ROAST_BUDGET: "abc" }), DAILY_BUDGET_DEFAULT);
});

test("demo cache stores per persona and expires after an hour", async () => {
  let t = 1_000_000;
  const kv = new MapKv(() => t);
  assert.equal(await getCachedDemoReportId(kv, "lurker"), null);
  await cacheDemoReportId(kv, "lurker", "abcd1234");
  assert.equal(await getCachedDemoReportId(kv, "lurker"), "abcd1234");
  assert.equal(await getCachedDemoReportId(kv, "gremlin"), null);
  t += 3_601_000;
  assert.equal(await getCachedDemoReportId(kv, "lurker"), null);
});
