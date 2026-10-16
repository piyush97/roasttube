import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  exchangeCode,
  newSessionId,
  putSession,
} from "@/lib/oauth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const raw = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });

  if (!code || !raw) {
    return NextResponse.redirect(new URL("/?error=oauth", req.url));
  }
  let saved: { state: string; verifier: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return NextResponse.redirect(new URL("/?error=oauth", req.url));
  }
  if (!state || state !== saved.state) {
    return NextResponse.redirect(new URL("/?error=oauth_state", req.url));
  }

  try {
    const { accessToken, expiresAt } = await exchangeCode(code, saved.verifier);
    const id = newSessionId();
    putSession(id, accessToken, expiresAt);
    jar.set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 3600,
    });
    return NextResponse.redirect(new URL("/report", req.url));
  } catch (e) {
    console.error("oauth callback failed:", e instanceof Error ? e.message : e);
    return NextResponse.redirect(new URL("/?error=oauth_token", req.url));
  }
}

