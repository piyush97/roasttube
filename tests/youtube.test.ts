import { test } from "node:test";
import assert from "node:assert/strict";
import { durationToSec, QUOTA_BUDGET } from "../src/lib/youtube.ts";

test("durationToSec parses common YouTube durations", () => {
  assert.equal(durationToSec("PT4M13S"), 253);
  assert.equal(durationToSec("PT1H2M3S"), 3723);
  assert.equal(durationToSec("PT45S"), 45);
  assert.equal(durationToSec("PT1H"), 3600);
  assert.equal(durationToSec("P1DT1H"), 90000);
  assert.equal(durationToSec("PT4H11M22S"), 15082);
});

test("durationToSec handles shorts boundary", () => {
  assert.equal(durationToSec("PT59S"), 59);
  assert.equal(durationToSec("PT60S"), 60);
});

test("durationToSec returns 0 on garbage", () => {
  assert.equal(durationToSec(""), 0);
  assert.equal(durationToSec("not-a-duration"), 0);
});

test("quota budget stays under daily limit and never implies search.list", () => {
  assert.ok(QUOTA_BUDGET <= 20);
});
