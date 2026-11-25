import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/supabase";
import { getExamSession } from "@/lib/sso";

export const dynamic = "force-dynamic";

async function requireStaff() {
  const user = await getExamSession();
  if (!user || !["admin", "director", "instructor"].includes(user.role)) {
    return null;
  }
  return user;
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const [{ data: tests }, { data: questions }, { data: attempts }] =
    await Promise.all([
      db.from("mock_tests").select("*").order("created_at", { ascending: false }),
      db
        .from("mock_questions")
        .select("id,question_text,exam,subject,topic,difficulty,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("mock_attempts")
        .select("id,test_id,student_id,score,total_marks,percentage,submitted_at")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(30),
    ]);

  return NextResponse.json({
    ok: true,
    staff,
    tests: tests ?? [],
    questions: questions ?? [],
    attempts: attempts ?? [],
  });
}

export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const db = getAdminDb();

    if (body.action === "toggle_status" && body.testId) {
      const nextStatus = body.status === "published" ? "published" : "draft";
      const { error } = await db
        .from("mock_tests")
        .update({ status: nextStatus })
        .eq("id", body.testId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const title = String(body.title || "Untitled Online Exam").trim();
    const examCategory = String(body.exam_category || "UPSC").trim();
    const subject = String(body.subject || "General Studies").trim();
    const durationMinutes = Math.max(5, Number(body.duration_minutes || 30));
    const negativeMarking = Math.max(0, Number(body.negative_marking ?? 0.33));
    const passingMarks = Math.max(0, Number(body.passing_marks ?? 0));
    const randomizeQuestions = Boolean(body.randomize_questions);
    const randomizeOptions = Boolean(body.randomize_options);
    const publishNow = body.publishImmediately !== false;
    const questions = Array.isArray(body.questions) ? body.questions : [];

    if (!questions.length) {
      return NextResponse.json(
        { error: "Add at least one MCQ to create the exam." },
        { status: 400 }
      );
    }

    const slug =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "exam";

    const { data: test, error: testError } = await db
      .from("mock_tests")
      .insert({
        title,
        slug: `${slug}-${Date.now()}`,
        description: body.description || "Created in Ibemhal IAS Online Exam Portal",
        exam_category: examCategory,
        subject,
        test_type: "full_length",
        duration_minutes: durationMinutes,
        total_marks: questions.length,
        negative_marking: negativeMarking,
        passing_marks: passingMarks,
        language: "English",
        show_answers_after_submit: true,
        show_solutions: true,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        status: publishNow ? "published" : "draft",
      })
      .select("*")
      .single();

    if (testError || !test) {
      return NextResponse.json(
        { error: testError?.message || "Failed to create exam." },
        { status: 500 }
      );
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const { data: qRow } = await db
        .from("mock_questions")
        .insert({
          question_text: String(q.question || "").trim(),
          question_type: "mcq_single",
          exam: examCategory,
          subject,
          topic: q.topic || subject,
          difficulty: ["easy", "medium", "hard"].includes(String(q.difficulty || "").toLowerCase())
            ? String(q.difficulty).toLowerCase()
            : "medium",
          explanation: q.explanation || null,
          verification_status: "verified",
          marks: 1,
          negative_marks: negativeMarking,
        })
        .select("id")
        .single();

      if (!qRow) continue;

      const opts = Array.isArray(q.options) ? q.options : [];
      if (opts.length) {
        await db.from("mock_question_options").insert(
          opts.map((optText: string, idx: number) => ({
            question_id: qRow.id,
            option_key: String.fromCharCode(65 + idx),
            option_text: String(optText),
            is_correct: idx === Number(q.correctIndex),
            sort_order: idx + 1,
          }))
        );
      }

      await db.from("mock_test_questions").insert({
        test_id: test.id,
        question_id: qRow.id,
        sort_order: i + 1,
      });
    }

    return NextResponse.json({ ok: true, test }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create exam." },
      { status: 500 }
    );
  }
}
