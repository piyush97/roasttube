import { test } from "node:test";
import assert from "node:assert/strict";
import { MapKv } from "../src/lib/kv.ts";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

test("get returns null for a missing key", async () => {
  const kv = new MapKv();
  assert.equal(await kv.get("nope"), null);
});

test("put/get roundtrip", async () => {
  const kv = new MapKv();
  await kv.put("a", "1");
  assert.equal(await kv.get("a"), "1");
});

test("entries expire after their ttl", async () => {
  const c = clock();
  const kv = new MapKv(c.now);
  await kv.put("a", "1", { expirationTtl: 60 });
  c.advance(59_000);
  assert.equal(await kv.get("a"), "1");
  c.advance(2_000);
  assert.equal(await kv.get("a"), null);
});

test("put without ttl never expires", async () => {
  const c = clock();
  const kv = new MapKv(c.now);
  await kv.put("a", "1");
  c.advance(10 * 365 * 24 * 3_600_000);
  assert.equal(await kv.get("a"), "1");
});

test("list honors prefix and limit", async () => {
  const kv = new MapKv();
  await kv.put("report:1", "a");
  await kv.put("report:2", "b");
  await kv.put("rl:x", "c");
  const all = await kv.list({ prefix: "report:" });
  assert.deepEqual(all.keys.map((k) => k.name), ["report:1", "report:2"]);
  const one = await kv.list({ prefix: "report:", limit: 1 });
  assert.equal(one.keys.length, 1);
});

test("list skips expired entries", async () => {
  const c = clock();
  const kv = new MapKv(c.now);
  await kv.put("a", "1", { expirationTtl: 1 });
  c.advance(2_000);
  assert.deepEqual((await kv.list()).keys, []);
});

test("delete removes a key", async () => {
  const kv = new MapKv();
  await kv.put("a", "1");
  await kv.delete("a");
  assert.equal(await kv.get("a"), null);
});
