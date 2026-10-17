import { test } from "node:test";
import assert from "node:assert/strict";
import { openSession, sealSession } from "../src/lib/oauth.ts";

async function withSecret<T>(secret: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.SESSION_SECRET;
  if (secret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = secret;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prev;
  }
}

test("seal/open round-trips {token, expiresAt} without exposing the token", async () => {
  await withSecret("test-secret-a", async () => {
    const session = { token: "ya29.secret-token-value", expiresAt: Date.now() + 60_000 };
    const sealed = await sealSession(session);
    assert.ok(!sealed.includes("ya29"), "sealed value must not contain the token");
    assert.deepEqual(await openSession(sealed), session);
  });
});

test("expired sessions open as null", async () => {
  await withSecret("test-secret-a", async () => {
    const sealed = await sealSession({ token: "t", expiresAt: Date.now() - 1_000 });
    assert.equal(await openSession(sealed), null);
  });
});

test("tampering with the sealed value invalidates it", async () => {
  await withSecret("test-secret-a", async () => {
    const sealed = await sealSession({ token: "t", expiresAt: Date.now() + 60_000 });
    const mid = Math.floor(sealed.length / 2);
    const flip = sealed[mid] === "A" ? "B" : "A";
    const tampered = sealed.slice(0, mid) + flip + sealed.slice(mid + 1);
    assert.notEqual(tampered, sealed);
    assert.equal(await openSession(tampered), null);
  });
});

test("empty and junk values open as null", async () => {
  await withSecret("test-secret-a", async () => {
    assert.equal(await openSession(""), null);
    assert.equal(await openSession("not-base64url!!!"), null);
    assert.equal(await openSession("AAAA"), null);
  });
});

test("a different SESSION_SECRET cannot open another secret's seal", async () => {
  const sealed = await withSecret("secret-one", () =>
    sealSession({ token: "t", expiresAt: Date.now() + 60_000 })
  );
  await withSecret("secret-two", async () => {
    assert.equal(await openSession(sealed), null);
  });
});

test("dev fallback works when SESSION_SECRET is unset", async () => {
  await withSecret(undefined, async () => {
    const session = { token: "t", expiresAt: Date.now() + 60_000 };
    const sealed = await sealSession(session);
    assert.deepEqual(await openSession(sealed), session);
  });
});

test("sealed cookie stays comfortably under the 4KB cookie budget", async () => {
  await withSecret("test-secret-a", async () => {
    const sealed = await sealSession({
      token: "x".repeat(300),
      expiresAt: Date.now() + 60_000,
    });
    assert.ok(sealed.length < 1024, `sealed length ${sealed.length}`);
  });
});
