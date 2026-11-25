"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

export default function ExamLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Unable to sign in");
      }
      router.replace(data.redirectTo || "/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unable to sign in");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-[#0b153c] via-[#14256f] to-[#1e3a8a] p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white p-7 shadow-2xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#14256f]">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black text-slate-950">
          Ibemhal IAS Exam Portal
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500">
          One Sign-In — use your Student, Teacher, Admin, or Director account
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Email or Username
            </label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or admin"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-[#14256f] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              Password
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-[#14256f] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14256f] py-3 text-sm font-black text-white shadow-md hover:bg-[#1d348f] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Signing in..." : "Sign In to Exam Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
