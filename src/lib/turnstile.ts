// Cloudflare Turnstile siteverify. No secret configured (local dev, tests)
// skips verification so the demo path works without Turnstile keys.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(opts: {
  secret: string | undefined;
  token: string | undefined;
  remoteIp?: string;
  fetchFn?: typeof fetch;
}): Promise<boolean> {
  if (!opts.secret) {
    // Fail closed: in production a missing secret must not silently disable
    // bot checks. Local dev and tests keep the skip so the demo works keyless.
    if (process.env.NODE_ENV === "production") {
      console.error("turnstile: secret is not configured in production; failing closed");
      return false;
    }
    return true;
  }
  if (!opts.token) return false;
  const body = new URLSearchParams({ secret: opts.secret, response: opts.token });
  if (opts.remoteIp) body.set("remoteip", opts.remoteIp);
  try {
    const res = await (opts.fetchFn ?? fetch)(VERIFY_URL, { method: "POST", body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
