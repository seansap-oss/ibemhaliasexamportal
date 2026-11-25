import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/supabase";
import { getExamSession } from "@/lib/sso";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const user = await getExamSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attemptId } = await context.params;
  const db = getAdminDb();

  const { data: attempt, error } = await db
    .from("mock_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (error || !attempt) {
    return NextResponse.json({ error: "Result not found." }, { status: 404 });
  }

  if (
    attempt.student_id !== user.id &&
    !["admin", "director", "instructor"].includes(user.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: test }, { data: allAttempts }, { data: answers }, { data: mappings }] =
    await Promise.all([
      db.from("mock_tests").select("*").eq("id", attempt.test_id).single(),
      db
        .from("mock_attempts")
        .select("id,score")
        .eq("test_id", attempt.test_id)
        .eq("status", "submitted")
        .order("score", { ascending: false }),
      db
        .from("mock_attempt_answers")
        .select("*")
        .eq("attempt_id", attemptId),
      db
        .from("mock_test_questions")
        .select(
          "sort_order,mock_questions(id,question_text,explanation,subject,topic,difficulty,mock_question_options(id,option_key,option_text,is_correct,sort_order))"
        )
        .eq("test_id", attempt.test_id)
        .order("sort_order", { ascending: true }),
    ]);

  const ranked = allAttempts ?? [];
  const rankIndex = ranked.findIndex((a: any) => a.id === attemptId);
  const rank = rankIndex >= 0 ? rankIndex + 1 : 1;
  const totalCandidates = ranked.length || 1;
  const topperScore = ranked[0]?.score ?? attempt.score ?? 0;
  const averageScore =
    ranked.reduce((s: number, a: any) => s + Number(a.score || 0), 0) /
    totalCandidates;
  const percentile =
    totalCandidates > 1
      ? Math.round(((totalCandidates - rank) / (totalCandidates - 1)) * 1000) / 10
      : 100;

  const ansMap = new Map((answers ?? []).map((a: any) => [a.question_id, a]));
  const review = (mappings ?? [])
    .map((m: any) => {
      const q = Array.isArray(m.mock_questions)
        ? m.mock_questions[0]
        : m.mock_questions;
      if (!q) return null;
      const ans: any = ansMap.get(q.id);
      const opts = (q.mock_question_options || []).sort(
        (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      return {
        id: q.id,
        question_text: q.question_text,
        explanation: q.explanation,
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        selected_option_ids: ans?.selected_option_ids || [],
        awarded_marks: ans?.awarded_marks ?? 0,
        time_spent_seconds: ans?.time_spent_seconds ?? 0,
        options: opts,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    user,
    test,
    attempt,
    analytics: {
      rank,
      totalCandidates,
      topperScore: Number(topperScore),
      averageScore: Number(averageScore.toFixed(2)),
      percentile,
    },
    review,
  });
}
