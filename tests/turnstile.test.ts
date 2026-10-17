import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstile } from "../src/lib/turnstile.ts";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function fakeFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return impl as unknown as typeof fetch;
}

const unusedFetch = fakeFetch(async () => {
  throw new Error("fetch must not be called");
});

test("verification is skipped when no secret is configured", async () => {
  assert.equal(await verifyTurnstile({ secret: undefined, token: undefined, fetchFn: unusedFetch }), true);
  assert.equal(await verifyTurnstile({ secret: "", token: undefined, fetchFn: unusedFetch }), true);
});

test("a configured secret with a missing token fails without a network call", async () => {
  assert.equal(await verifyTurnstile({ secret: "s", token: undefined, fetchFn: unusedFetch }), false);
  assert.equal(await verifyTurnstile({ secret: "s", token: "", fetchFn: unusedFetch }), false);
});

test("posts secret and response to siteverify and accepts success", async () => {
  const fetchFn = fakeFetch(async (url, init) => {
    assert.equal(url, VERIFY_URL);
    assert.equal(init?.method, "POST");
    const body = init?.body as URLSearchParams;
    assert.equal(body.get("secret"), "s");
    assert.equal(body.get("response"), "tok");
    assert.equal(body.get("remoteip"), null);
    return Response.json({ success: true });
  });
  assert.equal(await verifyTurnstile({ secret: "s", token: "tok", fetchFn }), true);
});

test("includes remoteip when provided", async () => {
  const fetchFn = fakeFetch(async (_url, init) => {
    assert.equal((init?.body as URLSearchParams).get("remoteip"), "1.2.3.4");
    return Response.json({ success: true });
  });
  assert.equal(await verifyTurnstile({ secret: "s", token: "tok", remoteIp: "1.2.3.4", fetchFn }), true);
});

test("rejects on success:false, non-OK responses, and network errors", async () => {
  const denied = fakeFetch(async () => Response.json({ success: false }));
  assert.equal(await verifyTurnstile({ secret: "s", token: "tok", fetchFn: denied }), false);

  const broken = fakeFetch(async () => new Response("nope", { status: 500 }));
  assert.equal(await verifyTurnstile({ secret: "s", token: "tok", fetchFn: broken }), false);

  const throwing = fakeFetch(async () => {
    throw new Error("network down");
  });
  assert.equal(await verifyTurnstile({ secret: "s", token: "tok", fetchFn: throwing }), false);
});
