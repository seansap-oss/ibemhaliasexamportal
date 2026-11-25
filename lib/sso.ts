import crypto from "crypto";
import { cookies } from "next/headers";

export const EXAM_SESSION_COOKIE = "ibemhal_exam_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days persistent login

export interface ExamSessionUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "instructor" | "admin" | "director";
  exp: number;
}

function getSharedSecret(): string {
  const s =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "ibemhal-exam-sso-dev-secret";
  return s;
}

export function signExamToken(
  user: Omit<ExamSessionUser, "exp">,
  ttlMs: number = SESSION_TTL_MS
): string {
  const payload: ExamSessionUser = {
    ...user,
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSharedSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyExamToken(token: string | undefined): ExamSessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expected = crypto
    .createHmac("sha256", getSharedSecret())
    .update(encoded)
    .digest("base64url");

  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as ExamSessionUser;
    if (!parsed?.id || !parsed?.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getExamSession(): Promise<ExamSessionUser | null> {
  const store = await cookies();
  const token = store.get(EXAM_SESSION_COOKIE)?.value;
  return verifyExamToken(token);
}
