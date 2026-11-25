import { NextResponse } from "next/server";
import { getExamSession } from "@/lib/sso";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getExamSession();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user });
}
