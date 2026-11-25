import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/supabase";
import { getExamSession } from "@/lib/sso";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getExamSession();
    const db = getAdminDb();

    const { data: tests, error } = await db
      .from("mock_tests")
      .select(
        "id,title,description,exam_category,subject,test_type,duration_minutes,total_marks,negative_marking,passing_marks,language,status,randomize_questions,randomize_options,created_at"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let attempts: any[] = [];
    if (user?.id) {
      const { data: att } = await db
        .from("mock_attempts")
        .select(
          "id,test_id,status,score,total_marks,percentage,accuracy,correct_count,incorrect_count,unattempted_count,submitted_at,created_at"
        )
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      attempts = att ?? [];
    }

    return NextResponse.json({
      ok: true,
      user,
      tests: tests ?? [],
      attempts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load exams" },
      { status: 500 }
    );
  }
}
