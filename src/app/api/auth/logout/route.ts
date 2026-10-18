import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/oauth";

// POST-only: signing out is a state change, so GET must not do it (CSRF/link-prefetch hygiene).
// The UI posts a plain <form method="post">, so POST redirects back to / and works without JS.
export async function POST() {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: "/" });
  // 303 so the browser follows with a GET: a 307 would re-POST to / and
  // refreshing after that can prompt a form resubmission.
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"), 303);
}

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
