"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Flag,
  Loader2,
  Maximize2,
  ShieldAlert,
} from "lucide-react";

type QuestionItem = {
  id: string;
  question_text: string;
  subject: string;
  topic: string;
  difficulty: string;
  marks: number;
  negative_marks: number;
  options: Array<{ id: string; option_key: string; option_text: string }>;
};

export default function CbtExamRunnerPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [test, setTest] = React.useState<any>(null);
  const [questions, setQuestions] = React.useState<QuestionItem[]>([]);
  const [started, setStarted] = React.useState(false);

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string[]>>({});
  const [marked, setMarked] = React.useState<Set<string>>(new Set());
  const [visited, setVisited] = React.useState<Set<string>>(new Set());
  const [timeSpent, setTimeSpent] = React.useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = React.useState(1800);
  const [submitting, setSubmitting] = React.useState(false);

  // Anti-cheating & Proctoring
  const [tabWarnings, setTabWarnings] = React.useState(0);
  const [webcamOn, setWebcamOn] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    fetch(`/api/exams/${testId}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Unable to load exam");
        return d;
      })
      .then((d) => {
        if (!d) return;
        setTest(d.test);
        setQuestions(d.questions || []);
        setSecondsLeft((d.test?.duration_minutes || 30) * 60);
        if (d.questions?.[0]) {
          setVisited(new Set([d.questions[0].id]));
        }
      })
      .catch((e) => setError(e?.message || "Unable to load exam"))
      .finally(() => setLoading(false));
  }, [testId, router]);

  const submitExam = React.useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const totalDuration = (test?.duration_minutes || 30) * 60;
      const elapsedSeconds = Math.max(0, totalDuration - secondsLeft);
      const res = await fetch(`/api/exams/${testId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          marked: Array.from(marked),
          timeSpent,
          elapsedSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.attemptId) {
        throw new Error(data?.error || "Submit failed");
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      router.replace(`/result/${data.attemptId}`);
    } catch (e: any) {
      setError(e?.message || "Unable to submit exam");
      setSubmitting(false);
    }
  }, [submitting, test, secondsLeft, testId, answers, marked, timeSpent, router]);

  // Countdown + per-question time tracking
  React.useEffect(() => {
    if (!started || submitting) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          void submitExam();
          return 0;
        }
        return prev - 1;
      });
      const q = questions[currentIndex];
      if (q) {
        setTimeSpent((prev) => ({ ...prev, [q.id]: (prev[q.id] || 0) + 1 }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [started, submitting, questions, currentIndex, submitExam]);

  // Tab-switch / blur anti-cheating monitor
  React.useEffect(() => {
    if (!started) return;
    const onVisibility = () => {
      if (document.hidden) {
        setTabWarnings((w) => {
          const next = w + 1;
          if (next >= 3) {
            void submitExam();
          }
          return next;
        });
      }
    };
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("copy", prevent);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("copy", prevent);
    };
  }, [started, submitExam]);

  const enableWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setWebcamOn(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      setWebcamOn(false);
    }
  };

  const startTest = async () => {
    setStarted(true);
    try {
      await document.documentElement.requestFullscreen();
    } catch {}
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#14256f]" />
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-center shadow">
          <p className="text-sm font-bold text-red-700">{error || "Exam not found"}</p>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#14256f]">
            {test.exam_category}
          </span>
          <h1 className="mt-3 text-2xl font-black text-slate-950">{test.title}</h1>
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4 text-center text-xs">
            <div>
              <div className="font-black text-slate-900">{questions.length}</div>
              <div className="text-slate-500">Questions</div>
            </div>
            <div>
              <div className="font-black text-slate-900">{test.duration_minutes}m</div>
              <div className="text-slate-500">Duration</div>
            </div>
            <div>
              <div className="font-black text-slate-900">-{test.negative_marking}</div>
              <div className="text-slate-500">Negative Marking</div>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Anti-cheating active: switching tabs 3 times auto-submits the exam.
            </li>
            <li className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-blue-600" />
              Exam opens in Fullscreen CBT mode with Question Palette.
            </li>
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={enableWebcam}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Camera className="h-4 w-4" />
              {webcamOn ? "Webcam Proctoring Ready" : "Enable Webcam Proctoring"}
            </button>
            <button
              type="button"
              onClick={startTest}
              className="inline-flex items-center gap-2 rounded-xl bg-[#14256f] px-6 py-3 text-sm font-black text-white shadow hover:bg-[#1d348f]"
            >
              I Agree &amp; Start Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const selectOption = (qId: string, optId: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: [optId] }));
  };

  const clearResponse = () => {
    if (!currentQ) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQ.id];
      return copy;
    });
  };

  const goTo = (idx: number) => {
    setCurrentIndex(idx);
    const q = questions[idx];
    if (q) setVisited((prev) => new Set(prev).add(q.id));
  };

  const saveAndNext = () => {
    if (currentIndex < questions.length - 1) goTo(currentIndex + 1);
  };

  const markForReviewNext = () => {
    if (!currentQ) return;
    setMarked((prev) => new Set(prev).add(currentQ.id));
    saveAndNext();
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 select-none">
      {/* CBT Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#14256f] px-4 py-3 text-white shadow">
        <div>
          <div className="text-sm font-black">{test.title}</div>
          <div className="text-[11px] text-blue-200">
            Question {currentIndex + 1} of {questions.length}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {tabWarnings > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-200">
              <AlertTriangle className="h-3.5 w-3.5" /> Tab Warning {tabWarnings}/3
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-black">
            <Clock className="h-4 w-4 text-amber-300" />
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <button
            onClick={() => void submitExam()}
            disabled={submitting}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-white hover:bg-emerald-600"
          >
            {submitting ? "Submitting..." : "Submit Exam"}
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[1fr_320px]">
        {/* Question Area */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {currentQ ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs">
                <span className="font-black text-[#14256f]">
                  Q{currentIndex + 1} · {currentQ.subject}
                </span>
                <span className="font-bold text-slate-500">
                  +{currentQ.marks} / -{currentQ.negative_marks}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-base font-semibold leading-relaxed text-slate-900">
                {currentQ.question_text}
              </p>

              <div className="mt-6 space-y-2.5">
                {currentQ.options.map((opt) => {
                  const selected = (answers[currentQ.id] || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectOption(currentQ.id, opt.id)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition ${
                        selected
                          ? "border-[#14256f] bg-blue-50 font-bold text-[#14256f]"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${
                          selected
                            ? "bg-[#14256f] text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {opt.option_key}
                      </span>
                      <span>{opt.option_text}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={clearResponse}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Clear Response
                  </button>
                  <button
                    type="button"
                    onClick={markForReviewNext}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Mark for Review &amp; Next
                  </button>
                </div>
                <button
                  type="button"
                  onClick={saveAndNext}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#14256f] px-5 py-2.5 text-xs font-black text-white hover:bg-[#1d348f]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save &amp; Next
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* NTA / Pesofts Question Palette */}
        <aside className="space-y-4">
          {webcamOn && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
              <video ref={videoRef} autoPlay muted className="h-36 w-full object-cover" />
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wider text-slate-700">
              Question Palette
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAns = (answers[q.id] || []).length > 0;
                const isMark = marked.has(q.id);
                const isVis = visited.has(q.id);
                let cls = "bg-slate-100 text-slate-700 border-slate-200";
                if (isAns && isMark) cls = "bg-blue-600 text-white border-blue-600";
                else if (isMark) cls = "bg-violet-600 text-white border-violet-600";
                else if (isAns) cls = "bg-emerald-600 text-white border-emerald-600";
                else if (isVis) cls = "bg-rose-500 text-white border-rose-500";
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goTo(idx)}
                    className={`h-9 rounded-lg border text-xs font-black ${cls} ${
                      idx === currentIndex ? "ring-2 ring-amber-400" : ""
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-slate-600">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-600" /> Answered</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-500" /> Not Answered</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violet-600" /> Marked</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200" /> Not Visited</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
