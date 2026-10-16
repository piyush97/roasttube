import type { RoastReport, ScoreResult, Signals } from "./types.ts";
import { ROAST_SCHEMA, SAFETY, buildSystemPrompt, buildUserPrompt } from "./prompt.ts";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function roast(
  s: Signals,
  r: ScoreResult
): Promise<RoastReport> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
      contents: [
        { role: "user", parts: [{ text: buildUserPrompt(s, r) }] },
      ],
      generationConfig: {
        temperature: 1.0,
        responseMimeType: "application/json",
        responseSchema: ROAST_SCHEMA,
        safetySettings: SAFETY,
      },
    }),
  });

  if (!res.ok) {
    let msg = "";
    try {
      const body = await res.json();
      msg = body?.error?.message ?? JSON.stringify(body).slice(0, 300);
    } catch {
      msg = await res.text().then((t) => t.slice(0, 300));
    }
    throw new Error(`Gemini API ${res.status}: ${msg}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blocked = data?.promptFeedback?.blockReason;
    throw new Error(
      blocked
        ? `Gemini blocked the request (reason: ${blocked})`
        : "Gemini returned an empty response"
    );
  }

  const report = JSON.parse(text) as RoastReport;
  // Hard-compute wins over model self-report.
  report.brainrotScore = r.score;
  report.brainrotTier = r.tier;
  return report;
}
