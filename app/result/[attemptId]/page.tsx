"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Loader2,
  Printer,
  Trophy,
  XCircle,
} from "lucide-react";

export default function ResultScorecardPage() {
  const params = useParams<{ attemptId: string }>();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/results/${params.attemptId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [params.attemptId]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#14256f]" />
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="rounded-2xl bg-white p-6 text-sm font-bold text-red-600 shadow">
          Unable to load scorecard.
        </div>
      </div>
    );
  }

  const { test, attempt, analytics, review, user } = data;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="no-print flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#14256f] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Exam Portal
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#14256f] px-4 py-2 text-xs font-black text-white"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF Scorecard
          </button>
        </div>

        {/* Scorecard Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-700">
                Ibemhal IAS · Official Exam Scorecard
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-950">
                {test?.title}
              </h1>
              <p className="text-xs text-slate-500">
                Candidate: <b>{user?.name}</b> ({user?.email})
              </p>
            </div>
            <div className="rounded-2xl bg-[#14256f] px-5 py-3 text-center text-white">
              <div className="text-[10px] font-bold uppercase text-blue-200">
                Rank
              </div>
              <div className="text-2xl font-black">
                #{analytics.rank}{" "}
                <span className="text-xs font-medium text-blue-200">
                  / {analytics.totalCandidates}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            <div className="rounded-2xl bg-blue-50 p-3.5 text-center">
              <div className="text-xs font-bold text-slate-500">Your Score</div>
              <div className="mt-1 text-xl font-black text-[#14256f]">
                {attempt.score} / {attempt.total_marks}
              </div>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3.5 text-center">
              <div className="text-xs font-bold text-slate-500">Accuracy</div>
              <div className="mt-1 text-xl font-black text-emerald-700">
                {attempt.accuracy}%
              </div>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3.5 text-center">
              <div className="text-xs font-bold text-slate-500">Percentile</div>
              <div className="mt-1 text-xl font-black text-amber-800">
                {analytics.percentile}%
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3.5 text-center">
              <div className="text-xs font-bold text-slate-500">Topper Score</div>
              <div className="mt-1 text-xl font-black text-slate-900">
                {analytics.topperScore}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3.5 text-center">
              <div className="text-xs font-bold text-slate-500">Batch Avg</div>
              <div className="mt-1 text-xl font-black text-slate-900">
                {analytics.averageScore}
              </div>
            </div>
          </div>
        </div>

        {/* Question-by-Question Review */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
            <Trophy className="h-5 w-5 text-amber-500" />
            Detailed Solution Review
          </h2>
          <div className="mt-4 space-y-4">
            {(review || []).map((q: any, idx: number) => {
              const selectedSet = new Set(q.selected_option_ids || []);
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-[#14256f]">
                      Q{idx + 1} · {q.subject || "General"}
                    </span>
                    <span className="font-bold text-slate-600">
                      Marks: {q.awarded_marks} · Time: {q.time_spent_seconds}s
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {q.question_text}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {(q.options || []).map((o: any) => {
                      const picked = selectedSet.has(o.id);
                      return (
                        <div
                          key={o.id}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
                            o.is_correct
                              ? "bg-emerald-50 font-bold text-emerald-800 border border-emerald-200"
                              : picked
                              ? "bg-red-50 font-bold text-red-700 border border-red-200"
                              : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          <span>
                            {o.option_key}) {o.option_text}
                          </span>
                          {o.is_correct ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : picked ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <p className="mt-3 rounded-xl bg-blue-50/70 p-3 text-xs text-slate-700">
                      <b>Explanation:</b> {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
