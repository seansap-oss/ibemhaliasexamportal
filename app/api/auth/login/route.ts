import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getPublicDb } from "@/lib/supabase";
import { EXAM_SESSION_COOKIE, signExamToken } from "@/lib/sso";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email/Username and password are required." },
        { status: 400 }
      );
    }

    const adminEmail = (process.env.ADMIN_EMAIL || "admin@ibemhal.ias").toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "";

    let sessionUser: {
      id: string;
      email: string;
      name: string;
      role: "student" | "instructor" | "admin" | "director";
    } | null = null;

    // 1. Dedicated Admin Credentials Check
    if (
      adminPassword &&
      (identifier === "admin" || identifier === adminEmail) &&
      password === adminPassword
    ) {
      sessionUser = {
        id: "00000000-0000-0000-0000-000000000001",
        email: adminEmail,
        name: "Administrator",
        role: "admin",
      };
    } else {
      // 2. Supabase Auth (Student, Teacher/Instructor, Admin, Director)
      if (!identifier.includes("@")) {
        return NextResponse.json(
          { error: "Invalid credentials." },
          { status: 401 }
        );
      }
      const pub = getPublicDb();
      const { data, error } = await pub.auth.signInWithPassword({
        email: identifier,
        password,
      });

      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || "Invalid email or password." },
          { status: 401 }
        );
      }

      const db = getAdminDb();
      const { data: profile } = await db
        .from("profiles")
        .select("role,full_name,email")
        .eq("id", data.user.id)
        .maybeSingle();

      const rawRole = String(profile?.role || "student").toLowerCase();
      const role = (
        ["student", "instructor", "admin", "director"].includes(rawRole)
          ? rawRole
          : "student"
      ) as "student" | "instructor" | "admin" | "director";

      sessionUser = {
        id: data.user.id,
        email: profile?.email || data.user.email || identifier,
        name: profile?.full_name || identifier.split("@")[0],
        role,
      };
    }

    const token = signExamToken(sessionUser);
    const res = NextResponse.json({
      ok: true,
      user: sessionUser,
      redirectTo: ["admin", "director", "instructor"].includes(sessionUser.role)
        ? "/admin"
        : "/",
    });

    res.cookies.set(EXAM_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 }
    );
  }
}
