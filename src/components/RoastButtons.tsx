"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PERSONAS = [
  {
    id: "lurker",
    name: "The Lurker",
    teaser:
      "300 channels. Eleven likes since the last election. A Watch Later folder of 212 productivity videos, all unread, like every other list.",
  },
  {
    id: "gremlin",
    name: "The Gremlin",
    teaser:
      "240 likes in seven days, 92% of them under nine seconds. The 3 a.m. scroll left fingerprints. The court has questions about your sleep.",
  },
  {
    id: "essay-hoarder",
    name: "The Essay Hoarder",
    teaser:
      "Liked a four-hour video essay at 2:40 a.m. Watched forty minutes. At double speed. The essay is still not finished. Neither are you.",
  },
];

export function RoastButtons({
  oauthConfigured,
  geminiKey,
  signedIn,
  autoRunYouTube,
}: {
  oauthConfigured: boolean;
  geminiKey: boolean;
  signedIn: boolean;
  autoRunYouTube: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDemo(persona: string) {
    setBusy(persona);
    setError(null);
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "demo", persona }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? `Roast failed (${res.status}).`);
        setBusy(null);
        return;
      }
      router.push(`/report/${data.id}`);
    } catch {
      setError("Could not reach the court. Is the server still up?");
      setBusy(null);
    }
  }

  const demoDisabled = !geminiKey;
  const demoReason = "Needs GEMINI_API_KEY in .env.local — the roast engine runs on Gemini.";
  const oauthReason =
    "Needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env.local. Until then, the demo cases below are fully admissible.";

  async function runYouTube() {
    setBusy("youtube");
    setError(null);
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "youtube" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? `Roast failed (${res.status}).`);
        setBusy(null);
        return;
      }
      router.push(`/report/${data.id}`);
    } catch {
      setError("Could not reach the court. Is the server still up?");
      setBusy(null);
    }
  }

  // Landed via /?run=1 straight after Google login — start the roast, don't wait for a click.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoRunYouTube) return;
    window.history.replaceState(null, "", "/"); // strip ?run=1 so a refresh doesn't re-roast
    if (autoRan.current || !signedIn || !geminiKey) return;
    autoRan.current = true; // StrictMode double-invoke guard — one roast per login
    runYouTube();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-10">
      <div className="rule-double mb-6" />
      <h2 className="masthead text-3xl">Pick a defendant</h2>
      <p className="mt-1 text-[0.95rem] italic text-ink-soft">
        Three fabricated defendants, tried in advance. Same court, same
        standards, zero subpoenas.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {PERSONAS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            disabled={demoDisabled || busy !== null}
            title={demoDisabled ? demoReason : undefined}
            onClick={() => runDemo(p.id)}
            className="clipping flex flex-col gap-2 p-5 text-left transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
            style={{ transform: `rotate(${i === 1 ? 0.5 : -0.5}deg)` }}
          >
            <span className="dateline block">Exhibit {["A", "B", "C"][i]}</span>
            <span className="font-display text-2xl leading-tight">{p.name}</span>
            <span className="text-[0.92rem] leading-5 italic">{p.teaser}</span>
            <span className="mt-auto pt-2 font-mono text-xs uppercase tracking-wide text-[var(--red)]">
              {busy === p.id
                ? "The court is convening…"
                : demoDisabled
                  ? "Seized — no key"
                  : "Send to trial →"}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {signedIn ? (
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={busy !== null || !geminiKey}
              title={!geminiKey ? demoReason : undefined}
              onClick={runYouTube}
              className="inline-block border-4 border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-display text-xl uppercase tracking-wide text-[var(--paper)] transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "youtube"
                ? "Subpoenas flying…"
                : "Roast my YouTube →"}
            </button>
            <a
              href="/api/auth/logout"
              className="font-mono text-xs uppercase tracking-wide text-ink-soft underline"
            >
              Sign out
            </a>
          </div>
        ) : (
          <a
            href={oauthConfigured ? "/api/auth/login" : undefined}
            aria-disabled={!oauthConfigured}
            title={!oauthConfigured ? oauthReason : undefined}
            onClick={(e) => {
              if (!oauthConfigured) e.preventDefault();
            }}
            className={`inline-block border-4 border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-display text-xl uppercase tracking-wide text-[var(--paper)] ${
              oauthConfigured
                ? "transition-transform hover:-translate-y-0.5"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            Roast my YouTube
          </a>
        )}
        {!oauthConfigured && (
          <p className="mt-2 max-w-md font-mono text-xs leading-4 text-ink-soft">
            {oauthReason}
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="clipping mt-6 border-2 border-[var(--red)] p-4 text-[0.95rem]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
