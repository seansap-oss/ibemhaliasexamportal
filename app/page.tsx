"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Clock,
  ExternalLink,
  FileCheck2,
  LogOut,
  PlayCircle,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type TestRow = {
  id: string;
  title: string;
  description?: string;
  exam_category: string;
  subject?: string;
  duration_minutes: number;
  total_marks: number;
  negative_marking: number;
};

type AttemptRow = {
  id: string;
  test_id: string;
  score: number;
  total_marks: number;
  percentage: number;
  accuracy: number;
  submitted_at: string;
};

export default function ExamPortalHome() {
  const router = useRouter();
  const [user, setUser] = React.useState<any>(null);
  const [tests, setTests] = React.useState<TestRow[]>([]);
  const [attempts, setAttempts] = React.useState<AttemptRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [category, setCategory] = React.useState("All");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    fetch("/api/exams", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user || null);
        setTests(d.tests || []);
        setAttempts(d.attempts || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  };

  const categories = React.useMemo(
    () => [
      "All",
      ...Array.from(new Set(tests.map((t) => t.exam_category).filter(Boolean))),
    ],
    [tests]
  );

  const filtered = tests.filter((t) => {
    if (category !== "All" && t.exam_category !== category) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q) ||
      t.exam_category.toLowerCase().includes(q)
    );
  });

  const isStaff =
    user && ["admin", "director", "instructor"].includes(user.role);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#14256f] text-sm font-black text-white">
              Ib
            </div>
            <div>
              <div className="text-sm font-black text-slate-950">
                Ibemhal IAS · Online Exam Portal
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                CBT Test Conductor, Proctoring &amp; Rank Analytics
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://avitsolutionslms.online"
              className="hidden items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Main LMS <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {isStaff && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900 hover:bg-amber-200"
              >
                <Settings className="h-3.5 w-3.5" />
                Exam Builder
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-[#14256f] sm:inline-flex">
                  {user.name} ({user.role})
                </span>
                <button
                  onClick={logout}
                  title="Log Out"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#14256f] px-4 py-2 text-xs font-black text-white"
              >
                <UserRound className="h-3.5 w-3.5" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* Top Filters */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  category === c
                    ? "bg-[#14256f] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mock tests..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium"
            />
          </div>
        </div>

        {/* Available Exams */}
        <section>
          <h2 className="text-lg font-black text-slate-950">
            Available Online Exams ({loading ? "…" : filtered.length})
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((test) => (
              <div
                key={test.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#14256f]/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-[#14256f]">
                    {test.exam_category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> {test.duration_minutes} mins
                  </span>
                </div>
                <h3 className="mt-3 text-base font-black text-slate-950">
                  {test.title}
                </h3>
                {test.subject && (
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {test.subject}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                  <span>Marks: {test.total_marks}</span>
                  <span>•</span>
                  <span>Negative: -{test.negative_marking}</span>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100">
                  <Link
                    href={user ? `/exam/${test.id}` : "/login"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14256f] py-2.5 text-xs font-black text-white hover:bg-[#1d348f]"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {user ? "Start CBT Exam" : "Sign In to Start"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {!loading && !filtered.length && (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No published exams match this filter yet.
            </div>
          )}
        </section>

        {/* Recent Attempts / Scorecards */}
        {attempts.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-base font-black text-slate-950">
              <Award className="h-5 w-5 text-amber-500" />
              Your Recent Scorecards
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {attempts.map((a) => {
                const test = tests.find((t) => t.id === a.test_id);
                return (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {test?.title || "Online Exam"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Score: {a.score}/{a.total_marks} ({a.percentage}%) · Accuracy:{" "}
                        {a.accuracy}%
                      </div>
                    </div>
                    <Link
                      href={`/result/${a.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-[#14256f] hover:bg-blue-50"
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      View Rank &amp; Scorecard
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
