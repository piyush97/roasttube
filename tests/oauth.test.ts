import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildAuthUrl, exchangeCode, newPkce, redirectUri } from "../src/lib/oauth.ts";

process.env.GOOGLE_CLIENT_ID = "cid";
process.env.GOOGLE_CLIENT_SECRET = "secret";
process.env.NEXT_PUBLIC_APP_URL = "https://example.test";

test("newPkce challenge is S256 of verifier", () => {
  const { verifier, challenge } = newPkce();
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
});

test("buildAuthUrl sets PKCE, state, readonly scope, no offline access", () => {
  const u = new URL(buildAuthUrl("st", "ch"));
  assert.equal(u.searchParams.get("state"), "st");
  assert.equal(u.searchParams.get("code_challenge"), "ch");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("redirect_uri"), redirectUri());
  assert.equal(u.searchParams.get("scope"), "https://www.googleapis.com/auth/youtube.readonly");
  assert.equal(u.searchParams.get("access_type"), null);
});

test("exchangeCode returns token and expiry, throws on non-OK", async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ access_token: "tok", expires_in: 60 }))) as typeof fetch;
    const before = Date.now();
    const r = await exchangeCode("c", "v");
    assert.equal(r.accessToken, "tok");
    assert.ok(r.expiresAt >= before + 60_000);

    globalThis.fetch = (async () => new Response("bad", { status: 400 })) as typeof fetch;
    await assert.rejects(exchangeCode("c", "v"), /token exchange 400: bad/);
  } finally {
    globalThis.fetch = real;
  }
});
