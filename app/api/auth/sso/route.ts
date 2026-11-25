import { NextRequest, NextResponse } from "next/server";
import { EXAM_SESSION_COOKIE, signExamToken, verifyExamToken } from "@/lib/sso";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const nextPath = req.nextUrl.searchParams.get("next") || "/";
  const user = verifyExamToken(token);

  if (!user) {
    return NextResponse.redirect(new URL("/login?reason=sso_expired", req.url));
  }

  const sessionCookie = signExamToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const safeDest =
    nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : ["admin", "director", "instructor"].includes(user.role)
      ? "/admin"
      : "/";

  const res = NextResponse.redirect(new URL(safeDest, req.url));
  res.cookies.set(EXAM_SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
