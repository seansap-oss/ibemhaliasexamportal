import { NextResponse } from "next/server";
import { EXAM_SESSION_COOKIE } from "@/lib/sso";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(EXAM_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
