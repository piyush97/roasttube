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

// Restore NODE_ENV around a block so prod-behavior tests don't leak into others.
// Next's ProcessEnv types mark NODE_ENV readonly; node --test still lets us swap it.
function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

async function withNodeEnv<T>(env: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.NODE_ENV;
  setNodeEnv(env);
  try {
    return await fn();
  } finally {
    setNodeEnv(prev);
  }
}

test("verification is skipped when no secret is configured", async () => {
  await withNodeEnv(undefined, async () => {
    assert.equal(await verifyTurnstile({ secret: undefined, token: undefined, fetchFn: unusedFetch }), true);
    assert.equal(await verifyTurnstile({ secret: "", token: undefined, fetchFn: unusedFetch }), true);
  });
});

test("missing secret fails closed in production and logs an error", async () => {
  await withNodeEnv("production", async () => {
    const errors: unknown[][] = [];
    const prevError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    try {
      assert.equal(await verifyTurnstile({ secret: undefined, token: "tok", fetchFn: unusedFetch }), false);
      assert.equal(await verifyTurnstile({ secret: "", token: "tok", fetchFn: unusedFetch }), false);
    } finally {
      console.error = prevError;
    }
    assert.ok(errors.length >= 2, "each fail-closed check must log an error");
  });
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
