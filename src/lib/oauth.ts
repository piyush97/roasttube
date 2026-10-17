import { createHash, randomBytes } from "node:crypto";

export const OAUTH_STATE_COOKIE = "rt_oauth";
export const SESSION_COOKIE = "rt_session";

const SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const REDIRECT_PATH = "/api/auth/callback/google";

// Plan: RT_COOKIES=true forces Secure cookies on localhost (browsers treat
// localhost as a secure context), to exercise the production cookie path.
export function cookieSecure(): boolean {
  return process.env.RT_COOKIES === "true" || process.env.NODE_ENV === "production";
}

export function isOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return base + REDIRECT_PATH;
}

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthUrl(state: string, challenge: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  return u.toString();
}

export async function exchangeCode(code: string, verifier: string): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 300));
    throw new Error(`Google token exchange ${res.status}: ${body}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

// In-memory only: token lives until it expires or logout; never persisted to disk.
const sessions = new Map<string, { token: string; expiresAt: number }>();

export function putSession(id: string, token: string, expiresAt: number) {
  // prune expired sessions so the Map can't grow unbounded
  const now = Date.now();
  for (const [k, s] of sessions) if (s.expiresAt <= now) sessions.delete(k);
  sessions.set(id, { token, expiresAt });
}
export function getSession(id: string): { token: string; expiresAt: number } | undefined {
  const s = sessions.get(id);
  if (s && s.expiresAt < Date.now()) {
    sessions.delete(id);
    return undefined;
  }
  return s;
}
export function dropSession(id: string) {
  sessions.delete(id);
}
export function newSessionId(): string {
  return randomBytes(16).toString("base64url");
}
