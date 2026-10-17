import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, dropSession } from "@/lib/oauth";

export async function POST() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) dropSession(id);
  jar.delete({ name: SESSION_COOKIE, path: "/" });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) dropSession(id);
  jar.delete({ name: SESSION_COOKIE, path: "/" });
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}
