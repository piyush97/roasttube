import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import {
  OAUTH_STATE_COOKIE,
  buildAuthUrl,
  isOAuthConfigured,
  newPkce,
} from "@/lib/oauth";

export async function GET() {
  if (!isOAuthConfigured()) {
    return NextResponse.json(
      { error: "oauth_not_configured" },
      { status: 501 }
    );
  }
  const state = randomBytes(16).toString("base64url");
  const { verifier, challenge } = newPkce();
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthUrl(state, challenge));
}
