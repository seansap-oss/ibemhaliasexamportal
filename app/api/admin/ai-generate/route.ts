import { NextRequest, NextResponse } from "next/server";
import { getExamSession } from "@/lib/sso";
import { generateMcqsFromText, type AiProvider } from "@/lib/ai-exam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getExamSession();
  if (!user || !["admin", "director", "instructor"].includes(user.role)) {
    return NextResponse.json({ error: "Staff access required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const text = String(body.text || "").trim();
    const count = Math.min(30, Math.max(1, Number(body.count || 5)));
    const examCategory = String(body.examCategory || "UPSC").trim();
    const subject = String(body.subject || "General Studies").trim();
    const difficulty = String(body.difficulty || "medium").trim();
    const provider = (["auto", "gemini", "grok", "openai"].includes(String(body.provider))
      ? String(body.provider)
      : "auto") as AiProvider;

    if (text.length < 40) {
      return NextResponse.json(
        { error: "Please paste at least a short paragraph or story (40+ characters)." },
        { status: 400 }
      );
    }

    const result = await generateMcqsFromText({
      text,
      count,
      examCategory,
      subject,
      difficulty,
      provider,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    const msg =
      err?.message === "NO_AI_KEY"
        ? "No AI API key configured yet. Add GEMINI_API_KEY (free at aistudio.google.com) or GROK_API_KEY in Vercel Environment Variables."
        : err?.message || "Unable to generate MCQs.";
    return NextResponse.json({ error: msg }, { status: err?.message === "NO_AI_KEY" ? 503 : 500 });
  }
}
