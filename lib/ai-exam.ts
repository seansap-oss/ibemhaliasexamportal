export type AiProvider = "auto" | "gemini" | "grok" | "openai";

export interface GeneratedMcq {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface EssayGradeResult {
  score: number;
  maxMarks: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  providerUsed: string;
}

function getAvailableProviders(preferred: AiProvider): Array<"gemini" | "grok" | "openai"> {
  const available: Array<"gemini" | "grok" | "openai"> = [];
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasGrok = Boolean(process.env.GROK_API_KEY?.trim());
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (preferred === "gemini" && hasGemini) return ["gemini"];
  if (preferred === "grok" && hasGrok) return ["grok"];
  if (preferred === "openai" && hasOpenAi) return ["openai"];

  if (hasGemini) available.push("gemini");
  if (hasGrok) available.push("grok");
  if (hasOpenAi) available.push("openai");
  return available;
}

function extractJsonBlock(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const arrStart = raw.indexOf("[");
  const objStart = raw.indexOf("{");
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    const arrEnd = raw.lastIndexOf("]");
    if (arrEnd > arrStart) return raw.slice(arrStart, arrEnd + 1);
  }
  if (objStart !== -1) {
    const objEnd = raw.lastIndexOf("}");
    if (objEnd > objStart) return raw.slice(objStart, objEnd + 1);
  }
  return raw.trim();
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini API error (${res.status})`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

async function callOpenAiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        { role: "system", content: "You are an expert UPSC / Civil Services examiner. Always reply in valid JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `AI API error (${res.status})`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI provider returned an empty response.");
  return text;
}

async function runAiPrompt(prompt: string, preferred: AiProvider = "auto"): Promise<{ raw: string; providerUsed: string }> {
  const order = getAvailableProviders(preferred);
  if (!order.length) {
    throw new Error("NO_AI_KEY");
  }
  let lastErr: unknown = null;
  for (const provider of order) {
    try {
      if (provider === "gemini") {
        return { raw: await callGemini(prompt), providerUsed: "Gemini" };
      }
      if (provider === "grok") {
        const key = process.env.GROK_API_KEY!.trim();
        const model = process.env.GROK_MODEL?.trim() || "grok-3-mini";
        return {
          raw: await callOpenAiCompatible("https://api.x.ai/v1/chat/completions", key, model, prompt),
          providerUsed: "Grok",
        };
      }
      if (provider === "openai") {
        const key = process.env.OPENAI_API_KEY!.trim();
        const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
        return {
          raw: await callOpenAiCompatible("https://api.openai.com/v1/chat/completions", key, model, prompt),
          providerUsed: "OpenAI",
        };
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI request failed.");
}

export async function generateMcqsFromText(input: {
  text: string;
  count: number;
  examCategory: string;
  subject: string;
  difficulty: string;
  provider?: AiProvider;
}): Promise<{ questions: GeneratedMcq[]; providerUsed: string }> {
  const count = Math.min(30, Math.max(1, Number(input.count || 5)));
  const prompt = `Create ${count} high-quality ${input.difficulty} multiple-choice questions for ${input.examCategory} (${input.subject}) based STRICTLY on the passage/story below.
Return ONLY a JSON array of objects with exact keys:
- "question": string
- "options": array of exactly 4 distinct strings
- "correctIndex": integer 0, 1, 2, or 3
- "explanation": concise 1-2 sentence explanation
- "topic": short topic label
- "difficulty": "easy" | "medium" | "hard"

Passage / Story / Notes:
"""
${input.text.slice(0, 18000)}
"""`;

  const { raw, providerUsed } = await runAiPrompt(prompt, input.provider || "auto");
  const parsed = JSON.parse(extractJsonBlock(raw));
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
  const clean: GeneratedMcq[] = arr
    .filter((q: any) => q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length >= 4)
    .map((q: any) => ({
      question: q.question.trim(),
      options: [
        String(q.options[0] || "").trim(),
        String(q.options[1] || "").trim(),
        String(q.options[2] || "").trim(),
        String(q.options[3] || "").trim(),
      ] as [string, string, string, string],
      correctIndex: Math.min(3, Math.max(0, Number(q.correctIndex || 0))),
      explanation: String(q.explanation || "").trim(),
      topic: String(q.topic || input.subject).trim(),
      difficulty: (["easy", "medium", "hard"].includes(String(q.difficulty || "").toLowerCase())
        ? String(q.difficulty).toLowerCase()
        : "medium") as "easy" | "medium" | "hard",
    }));

  if (!clean.length) {
    throw new Error("AI did not return valid MCQs. Please try with a longer passage.");
  }
  return { questions: clean, providerUsed };
}

export async function gradeEssayWithAi(input: {
  question: string;
  rubric?: string | null;
  studentEssay: string;
  maxMarks: number;
  provider?: AiProvider;
}): Promise<EssayGradeResult> {
  const maxMarks = Math.max(1, Number(input.maxMarks || 10));
  const trimmed = input.studentEssay.trim();

  if (!trimmed) {
    return {
      score: 0,
      maxMarks,
      feedback: "No answer was submitted for this essay question.",
      strengths: [],
      improvements: ["Write a structured answer covering introduction, body arguments, and conclusion."],
      providerUsed: "System",
    };
  }

  const prompt = `You are a strict, fair UPSC Mains / Civil Services examiner. Grade the student's essay/descriptive answer out of ${maxMarks} marks.
Question: ${input.question}
Grading Rubric / Key Points: ${input.rubric || "Clarity, factual accuracy, balanced analysis, structure (Intro-Body-Conclusion), and relevance."}

Student Answer:
"""
${trimmed.slice(0, 12000)}
"""

Return ONLY a JSON object with exact keys:
- "score": number between 0 and ${maxMarks} (can use .5 increments)
- "feedback": 2-3 sentence constructive summary
- "strengths": array of 2-3 short bullet strings
- "improvements": array of 2-3 specific actionable tips`;

  try {
    const { raw, providerUsed } = await runAiPrompt(prompt, input.provider || "auto");
    const parsed = JSON.parse(extractJsonBlock(raw));
    const score = Math.min(maxMarks, Math.max(0, Number(Number(parsed.score || 0).toFixed(2))));
    return {
      score,
      maxMarks,
      feedback: String(parsed.feedback || "Evaluated by AI examiner.").trim(),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 4) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String).slice(0, 4) : [],
      providerUsed,
    };
  } catch (err: any) {
    // Graceful fallback if GEMINI_API_KEY / GROK_API_KEY is not configured yet
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    const ratio = Math.min(0.65, words / 180);
    const est = Number((maxMarks * ratio).toFixed(1));
    const reason =
      err?.message === "NO_AI_KEY"
        ? "Add GEMINI_API_KEY or GROK_API_KEY in Vercel to enable full AI semantic grading."
        : `AI grading fallback (${err?.message || "unavailable"}).`;
    return {
      score: est,
      maxMarks,
      feedback: `Preliminary length-based score (${words} words). ${reason}`,
      strengths: words >= 80 ? ["Good length and effort."] : [],
      improvements: ["Configure Gemini or Grok API key for full rubric-based UPSC Mains feedback."],
      providerUsed: "Pending AI Key",
    };
  }
}
