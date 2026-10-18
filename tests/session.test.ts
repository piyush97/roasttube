import { test } from "node:test";
import assert from "node:assert/strict";
import { cookieSecure, openSession, sealSession } from "../src/lib/oauth.ts";

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

test("SESSION_SECRET unset fails closed in production", async () => {
  await withSecret(undefined, async () => {
    await withNodeEnv("production", async () => {
      await assert.rejects(() => sealSession({ token: "t", expiresAt: Date.now() + 60_000 }));
      await assert.rejects(() => openSession("whatever-value"));
    });
  });
});

test("cookie is Secure when the app URL is https even outside production", async () => {
  const prevUrl = process.env.NEXT_PUBLIC_APP_URL;
  const prevRt = process.env.RT_COOKIES;
  delete process.env.RT_COOKIES;
  process.env.NEXT_PUBLIC_APP_URL = "https://roasttube.piyushmehta.com";
  try {
    await withNodeEnv("development", async () => {
      assert.equal(cookieSecure(), true);
    });
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevUrl;
    if (prevRt === undefined) delete process.env.RT_COOKIES;
    else process.env.RT_COOKIES = prevRt;
  }
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
