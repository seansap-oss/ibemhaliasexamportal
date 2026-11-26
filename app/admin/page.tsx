"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Plus, Sparkles, Upload } from "lucide-react";

type DraftQ = {
  question_type?: "mcq_single" | "essay";
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  marks?: number;
  rubric?: string;
};

export default function AdminExamBuilderPage() {
  const [tests, setTests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [examCategory, setExamCategory] = React.useState("UPSC");
  const [subject, setSubject] = React.useState("General Studies");
  const [duration, setDuration] = React.useState(30);
  const [negative, setNegative] = React.useState(0.33);
  const [randomizeQ, setRandomizeQ] = React.useState(true);
  const [randomizeOpt, setRandomizeOpt] = React.useState(true);

  const [questions, setQuestions] = React.useState<DraftQ[]>([
    {
      question: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      explanation: "",
    },
  ]);

  const [csvText, setCsvText] = React.useState("");
  const [aiText, setAiText] = React.useState("");
  const [aiCount, setAiCount] = React.useState(5);
  const [aiDifficulty, setAiDifficulty] = React.useState("medium");
  const [aiProvider, setAiProvider] = React.useState<"auto" | "gemini" | "grok">("auto");
  const [aiBusy, setAiBusy] = React.useState(false);

  const generateWithAi = async () => {
    setAiBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiText,
          count: aiCount,
          examCategory,
          subject,
          difficulty: aiDifficulty,
          provider: aiProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "AI generation failed.");
      const generated: DraftQ[] = (data.questions || []).map((q: any) => ({
        question_type: "mcq_single",
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || "",
        marks: 1,
      }));
      setQuestions((prev) =>
        prev.length === 1 && !prev[0].question.trim() ? generated : [...prev, ...generated]
      );
      setMsg(`Generated ${generated.length} MCQs using ${data.providerUsed}! Review or click Publish Exam.`);
    } catch (e: any) {
      setErr(e?.message || "AI generation failed.");
    } finally {
      setAiBusy(false);
    }
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/exams", { cache: "no-store" });
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      const d = await r.json();
      setTests(d.tests || []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const parseBulkCsv = () => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed: DraftQ[] = [];
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 6) {
        const ansIdx = Math.max(0, Math.min(3, Number(parts[5]) - 1 || 0));
        parsed.push({
          question: parts[0],
          options: [parts[1], parts[2], parts[3], parts[4]],
          correctIndex: ansIdx,
          explanation: parts[6] || "",
        });
      }
    }
    if (parsed.length) {
      setQuestions((prev) => [
        ...prev.filter((q) => q.question.trim()),
        ...parsed,
      ]);
      setCsvText("");
      setMsg(`Imported ${parsed.length} questions from bulk text!`);
    }
  };

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const validQ = questions.filter((q) => q.question.trim());
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          exam_category: examCategory,
          subject,
          duration_minutes: duration,
          negative_marking: negative,
          randomize_questions: randomizeQ,
          randomize_options: randomizeOpt,
          publishImmediately: true,
          questions: validQ,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d?.ok) throw new Error(d?.error || "Failed to save exam");
      setMsg(`Published "${d.test.title}"!`);
      setTitle("");
      setQuestions([
        { question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" },
      ]);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to save exam");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (testId: string, current: string) => {
    await fetch("/api/admin/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_status",
        testId,
        status: current === "published" ? "draft" : "published",
      }),
    });
    await load();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#14256f] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Student Exam Portal
            </Link>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              Exam Builder &amp; Question Bank
            </h1>
          </div>
        </div>

        <form
          onSubmit={createExam}
          className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {err && (
            <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
              {err}
            </div>
          )}
          {msg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {msg}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700">
                Exam Title *
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., UPSC Prelims GS Full Test 01"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Category
              </label>
              <input
                value={examCategory}
                onChange={(e) => setExamCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Duration (mins)
              </label>
              <input
                type="number"
                min={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-semibold">
            <label className="flex items-center gap-2">
              <span>Negative Marking:</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={negative}
                onChange={(e) => setNegative(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={randomizeQ}
                onChange={(e) => setRandomizeQ(e.target.checked)}
              />
              Shuffle Questions
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={randomizeOpt}
                onChange={(e) => setRandomizeOpt(e.target.checked)}
              />
              Shuffle Options
            </label>
          </div>

          {/* AI Story / Passage -> MCQ Generator */}
          <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#14256f]">
                <Sparkles className="h-4 w-4 text-violet-600" />
                AI Exam Maker (Paste Story, Article, or Notes → Auto-Generate MCQs)
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as "auto" | "gemini" | "grok")}
                  className="rounded-lg border border-violet-200 bg-white px-2.5 py-1"
                >
                  <option value="auto">Auto (Gemini / Grok)</option>
                  <option value="gemini">Gemini API</option>
                  <option value="grok">Grok API</option>
                </select>
                <select
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="rounded-lg border border-violet-200 bg-white px-2.5 py-1"
                >
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} MCQs
                    </option>
                  ))}
                </select>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value)}
                  className="rounded-lg border border-violet-200 bg-white px-2.5 py-1"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard / UPSC</option>
                </select>
              </div>
            </div>
            <textarea
              rows={4}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Paste any story, current affairs article, textbook chapter, or lecture notes here..."
              className="mt-2.5 w-full rounded-xl border border-violet-200 bg-white p-3 text-xs"
            />
            <button
              type="button"
              disabled={aiBusy || aiText.trim().length < 40}
              onClick={() => void generateWithAi()}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2 text-xs font-black text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {aiBusy ? "Generating MCQs…" : "Generate MCQs with AI"}
            </button>
          </div>

          {/* Bulk Importer */}
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="text-xs font-black text-slate-800">
              Bulk Import Questions (Pipe-separated: Question | Opt A | Opt B | Opt C | Opt D | Correct 1-4 | Explanation)
            </div>
            <textarea
              rows={3}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Capital of Manipur? | Imphal | Thoubal | Bishnupur | Ukhrul | 1 | Imphal is the capital."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
            />
            <button
              type="button"
              onClick={parseBulkCsv}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white"
            >
              <Upload className="h-3.5 w-3.5" /> Import Questions
            </button>
          </div>

          {/* Manual Questions (MCQ & Essay) */}
          <div className="space-y-4">
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-black text-[#14256f]">
                    Question {qi + 1} · {q.question_type === "essay" ? "Essay / Subjective (AI Graded)" : "MCQ"}
                  </div>
                  {q.question_type === "essay" && (
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                      Max Marks:
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={q.marks || 10}
                        onChange={(e) => {
                          const copy = [...questions];
                          copy[qi].marks = Number(e.target.value);
                          setQuestions(copy);
                        }}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1"
                      />
                    </label>
                  )}
                </div>
                <input
                  value={q.question}
                  onChange={(e) => {
                    const copy = [...questions];
                    copy[qi].question = e.target.value;
                    setQuestions(copy);
                  }}
                  placeholder={q.question_type === "essay" ? "Enter UPSC Mains / Essay prompt..." : "Enter question text..."}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                {q.question_type === "essay" ? (
                  <textarea
                    rows={2}
                    value={q.rubric || ""}
                    onChange={(e) => {
                      const copy = [...questions];
                      copy[qi].rubric = e.target.value;
                      setQuestions(copy);
                    }}
                    placeholder="Optional AI Grading Rubric / Key points (e.g. Intro 2m, Constitutional Articles 4m, Conclusion 2m)..."
                    className="w-full rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs"
                  />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${qi}`}
                          checked={q.correctIndex === oi}
                          onChange={() => {
                            const copy = [...questions];
                            copy[qi].correctIndex = oi;
                            setQuestions(copy);
                          }}
                        />
                        <input
                          value={opt}
                          onChange={(e) => {
                            const copy = [...questions];
                            copy[qi].options[oi] = e.target.value;
                            setQuestions(copy);
                          }}
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) => [
                    ...prev,
                    {
                      question_type: "mcq_single",
                      question: "",
                      options: ["", "", "", ""],
                      correctIndex: 0,
                      explanation: "",
                      marks: 1,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700"
              >
                <Plus className="h-4 w-4" /> Add MCQ
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) => [
                    ...prev,
                    {
                      question_type: "essay",
                      question: "",
                      options: ["", "", "", ""],
                      correctIndex: 0,
                      explanation: "",
                      marks: 10,
                      rubric: "",
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900"
              >
                <FileText className="h-4 w-4" /> Add Essay / Mains Question
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#14256f] px-6 py-3 text-sm font-black text-white hover:bg-[#1d348f]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save &amp; Publish Exam
          </button>
        </form>

        {/* Existing Exams */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-black text-slate-950">
            All Exams ({loading ? "…" : tests.length})
          </h2>
          <div className="mt-3 divide-y divide-slate-100">
            {tests.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{t.title}</div>
                  <div className="text-slate-500">
                    {t.exam_category} · {t.duration_minutes} mins · {t.total_marks} marks
                  </div>
                </div>
                <button
                  onClick={() => void toggleStatus(t.id, t.status)}
                  className={`rounded-lg px-3 py-1.5 font-bold ${
                    t.status === "published"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {t.status === "published" ? "Published" : "Draft"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
