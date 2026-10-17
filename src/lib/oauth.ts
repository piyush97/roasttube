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

// Sessions are sealed into the httpOnly cookie itself with AES-GCM (WebCrypto),
// so no server-side session store is needed and the token never persists to
// disk. The payload is exactly {token, expiresAt}; no refresh tokens are kept.
export type Session = { token: string; expiresAt: number };

// Per-process random fallback for local dev: sessions last until restart,
// matching the old in-memory behavior. Production must set SESSION_SECRET.
const DEV_SECRET = randomBytes(32).toString("hex");

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const b64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob(b64 + pad);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

let cachedKey: { secret: string; key: CryptoKey } | null = null;

async function sessionKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET ?? DEV_SECRET;
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const key = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  cachedKey = { secret, key };
  return key;
}

export async function sealSession(session: Session): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await sessionKey(),
      encoder.encode(JSON.stringify(session))
    )
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv);
  out.set(ciphertext, iv.length);
  return toBase64url(out);
}

export async function openSession(value: string): Promise<Session | null> {
  if (!value) return null;
  const raw = fromBase64url(value);
  if (!raw || raw.length <= 12) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: raw.subarray(0, 12) },
      await sessionKey(),
      raw.subarray(12)
    );
    const parsed = JSON.parse(decoder.decode(plaintext)) as Partial<Session>;
    if (typeof parsed.token !== "string" || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}
