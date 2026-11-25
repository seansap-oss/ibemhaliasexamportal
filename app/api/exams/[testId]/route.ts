import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/supabase";
import { getExamSession } from "@/lib/sso";

export const dynamic = "force-dynamic";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ testId: string }> }
) {
  const user = await getExamSession();
  if (!user) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  const { testId } = await context.params;
  const db = getAdminDb();

  const { data: test, error: testError } = await db
    .from("mock_tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (testError || !test) {
    return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  }

  const { data: mappings, error: mapError } = await db
    .from("mock_test_questions")
    .select(
      "sort_order,marks_override,negative_marks_override,mock_questions(id,question_type,question_text,subject,topic,difficulty,marks,negative_marks,mock_question_options(id,option_key,option_text,sort_order))"
    )
    .eq("test_id", testId)
    .order("sort_order", { ascending: true });

  if (mapError) {
    return NextResponse.json({ error: mapError.message }, { status: 500 });
  }

  let questions = (mappings ?? [])
    .map((m: any) => {
      const q = Array.isArray(m.mock_questions)
        ? m.mock_questions[0]
        : m.mock_questions;
      if (!q) return null;
      let opts = (q.mock_question_options || []).sort(
        (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      if (test.randomize_options) opts = shuffle(opts);
      return {
        id: q.id,
        question_type: q.question_type,
        question_text: q.question_text,
        subject: q.subject || test.subject || "General Studies",
        topic: q.topic || "General",
        difficulty: q.difficulty || "medium",
        marks: Number(m.marks_override ?? q.marks ?? 1),
        negative_marks: Number(
          m.negative_marks_override ?? q.negative_marks ?? test.negative_marking ?? 0
        ),
        options: opts.map((o: any) => ({
          id: o.id,
          option_key: o.option_key,
          option_text: o.option_text,
        })),
      };
    })
    .filter(Boolean);

  if (test.randomize_questions) {
    questions = shuffle(questions);
  }

  return NextResponse.json({ ok: true, test, questions });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ testId: string }> }
) {
  const user = await getExamSession();
  if (!user) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  try {
    const { testId } = await context.params;
    const body = await req.json();
    const answersMap = (body.answers || {}) as Record<string, string[]>;
    const markedSet = new Set<string>(body.marked || []);
    const timeSpentMap = (body.timeSpent || {}) as Record<string, number>;
    const elapsedSeconds = Number(body.elapsedSeconds || 0);

    const db = getAdminDb();

    const { data: test } = await db
      .from("mock_tests")
      .select("*")
      .eq("id", testId)
      .single();

    if (!test) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    const { data: mappings } = await db
      .from("mock_test_questions")
      .select(
        "marks_override,negative_marks_override,mock_questions(id,marks,negative_marks,mock_question_options(id,is_correct))"
      )
      .eq("test_id", testId);

    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const answerRows: Array<{
      question_id: string;
      selected_option_ids: string[];
      marked_for_review: boolean;
      time_spent_seconds: number;
      awarded_marks: number;
    }> = [];

    for (const m of mappings ?? []) {
      const q: any = Array.isArray(m.mock_questions)
        ? m.mock_questions[0]
        : m.mock_questions;
      if (!q) continue;

      const marks = Number(m.marks_override ?? q.marks ?? 1);
      const neg = Number(
        m.negative_marks_override ?? q.negative_marks ?? test.negative_marking ?? 0
      );
      totalMarks += marks;

      const selected = Array.isArray(answersMap[q.id]) ? answersMap[q.id] : [];
      const correctIds = (q.mock_question_options || [])
        .filter((o: any) => o.is_correct)
        .map((o: any) => o.id);

      let awarded = 0;
      if (!selected.length) {
        unattemptedCount++;
      } else {
        const isExactMatch =
          selected.length === correctIds.length &&
          selected.every((id) => correctIds.includes(id));
        if (isExactMatch) {
          correctCount++;
          awarded = marks;
          score += marks;
        } else {
          incorrectCount++;
          awarded = -neg;
          score -= neg;
        }
      }

      answerRows.push({
        question_id: q.id,
        selected_option_ids: selected,
        marked_for_review: markedSet.has(q.id),
        time_spent_seconds: Number(timeSpentMap[q.id] || 0),
        awarded_marks: awarded,
      });
    }

    const attempted = correctCount + incorrectCount;
    const accuracy = attempted > 0 ? (correctCount / attempted) * 100 : 0;
    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

    const { data: attempt, error: attemptError } = await db
      .from("mock_attempts")
      .insert({
        test_id: testId,
        student_id: user.id,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        elapsed_seconds: elapsedSeconds,
        score: Number(score.toFixed(2)),
        total_marks: Number(totalMarks.toFixed(2)),
        percentage: Number(percentage.toFixed(2)),
        accuracy: Number(accuracy.toFixed(2)),
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        unattempted_count: unattemptedCount,
      })
      .select("id")
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: attemptError?.message || "Unable to save attempt." },
        { status: 500 }
      );
    }

    if (answerRows.length) {
      await db.from("mock_attempt_answers").insert(
        answerRows.map((r) => ({
          ...r,
          attempt_id: attempt.id,
        }))
      );
    }

    return NextResponse.json({
      ok: true,
      attemptId: attempt.id,
      score,
      totalMarks,
      percentage,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Submit failed" },
      { status: 500 }
    );
  }
}
