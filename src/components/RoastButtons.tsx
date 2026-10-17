"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TurnstileWidget, type TurnstileHandle } from "@/components/TurnstileWidget";

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

// Error contract v2: responses are { error: <code>, message: <string> } and the
// server message is a short public one. Raw upstream text never reaches the
// page: a missing or suspiciously long message falls back to our own copy.
const ERROR_FALLBACKS: Record<string, string> = {
  rate_limited:
    "The court has hit its hourly case limit. Breathe: try again later.",
  turnstile_failed:
    "The bot check did not clear. Click the case again and the court will ask for the witness again.",
  budget_exhausted:
    "The court has heard enough cases today. Come back tomorrow.",
  not_signed_in:
    "You are not signed in with Google. Sign in and the court can hear the case.",
  reauth:
    "Your Google session went stale. Sign in again and the court will resume.",
  youtube_failed:
    "YouTube did not hand over the evidence. Demand a retrial.",
  gemini_failed:
    "The roast engine is oversubscribed right now. Give it a minute and demand a retrial.",
  bad_request: "The docket did not make sense. Reload the page and file again.",
};

type CourtError = {
  text: string;
  action: "none" | "retry" | "signin";
  retry: (() => void) | null;
};

function readError(data: unknown, retry: () => void): CourtError {
  const body = (data ?? {}) as { error?: unknown; message?: unknown };
  const code = typeof body.error === "string" ? body.error : "";
  const fallback =
    ERROR_FALLBACKS[code] ?? "The court hit a snag. Try the case again.";
  const raw = typeof body.message === "string" ? body.message.trim() : "";
  const text = raw.length > 0 && raw.length <= 240 ? raw : fallback;
  const action: CourtError["action"] =
    code === "youtube_failed" || code === "gemini_failed"
      ? "retry"
      : code === "reauth" || code === "not_signed_in"
        ? "signin"
        : "none";
  return { text, action, retry: action === "retry" ? retry : null };
}

export function RoastButtons({
  oauthConfigured,
  geminiKey,
  signedIn,
  autoRunYouTube,
  turnstileSiteKey,
}: {
  oauthConfigured: boolean;
  geminiKey: boolean;
  signedIn: boolean;
  autoRunYouTube: boolean;
  turnstileSiteKey?: string;
}) {
  const router = useRouter();
  const turnstile = useRef<TurnstileHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<CourtError | null>(null);

  const demoDisabled = !geminiKey;
  const demoReason = "Needs GEMINI_API_KEY — the roast engine runs on Gemini.";
  const oauthReason =
    "Needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. Until then, the demo cases below are fully admissible.";

  async function requestRoast(
    body: Record<string, unknown>,
    retry: () => void
  ) {
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as {
        id?: unknown;
        error?: unknown;
        message?: unknown;
      } | null;
      if (!res.ok) {
        setError(readError(data, retry));
        setBusy(null);
        return;
      }
      const id = data && typeof data.id === "string" ? data.id : "";
      if (!id) {
        setError(readError({ error: "bad_request" }, retry));
        setBusy(null);
        return;
      }
      router.push(`/report/${id}?fresh=1`);
    } catch {
      setError({
        text: "Could not reach the court. Is the server still up?",
        action: "retry",
        retry,
      });
      setBusy(null);
    }
  }

  async function runDemo(persona: string) {
    if (demoDisabled || busy !== null) return;
    setBusy(persona);
    setElapsed(0);
    setError(null);
    let turnstileToken: string | undefined;
    try {
      // A fresh single-use token per request; the server verifies when configured.
      turnstileToken = turnstileSiteKey
        ? ((await turnstile.current?.execute()) ?? undefined)
        : undefined;
    } catch {
      turnstileToken = undefined;
    }
    await requestRoast(
      {
        source: "demo",
        persona,
        ...(turnstileToken ? { turnstileToken } : {}),
      },
      () => void runDemo(persona)
    );
  }

  async function runYouTube() {
    if (busy !== null || !geminiKey) return;
    setBusy("youtube");
    setElapsed(0);
    setError(null);
    await requestRoast({ source: "youtube" }, () => void runYouTube());
  }

  // Busy clock: the strip escalates after ~8 seconds with a ticking counter.
  // The tick lives in the timer callback only (no setState in the effect body).
  useEffect(() => {
    if (busy === null) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const status =
    busy === null
      ? ""
      : elapsed >= 8
        ? `The court is still deliberating... (${elapsed}s elapsed)`
        : "The court is hearing your case...";

  // Landed via /?run=1 straight after Google login — start the roast, don't wait for a click.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoRunYouTube) return;
    window.history.replaceState(null, "", "/"); // strip ?run=1 so a refresh doesn't re-roast
    if (autoRan.current || !signedIn || !geminiKey) return;
    autoRan.current = true; // StrictMode double-invoke guard — one roast per login
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    // The busy state lives below the masthead; bring the court back into view.
    rootRef.current?.scrollIntoView({
      block: "start",
      behavior: reduced ? "auto" : "smooth",
    });
    runYouTube();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className="mt-10">
      <div
        role="status"
        aria-live="polite"
        className={`mb-4 border-2 border-[var(--ink)] px-4 py-3 font-mono text-xs uppercase tracking-wide ${
          status ? "" : "sr-only"
        }`}
      >
        {status}
      </div>
      <div className="rule-double mb-6" />
      <h2 className="masthead text-3xl">Pick a defendant</h2>
      <p className="mt-1 text-[0.95rem] italic text-ink-soft">
        {
          "Three fabricated defendants, tried in advance. No sign-in, no account: pure demo. Same court, same standards, zero subpoenas."
        }
      </p>
      <p className="mt-4 font-mono text-xs tracking-wide text-[var(--red)]">
        {"Start here: the demo runs without a login."}
      </p>

      <div
        className="mt-4 grid gap-5 sm:grid-cols-3"
        aria-busy={busy !== null}
      >
        {PERSONAS.map((p, i) => {
          const personaDisabled = demoDisabled || busy !== null;
          return (
            <button
              key={p.id}
              type="button"
              aria-disabled={personaDisabled}
              title={demoDisabled ? demoReason : undefined}
              onClick={() => {
                if (personaDisabled) return;
                runDemo(p.id);
              }}
              className={`clipping flex flex-col gap-2 p-5 text-left transition-transform ${
                personaDisabled
                  ? "cursor-not-allowed opacity-55"
                  : "hover:-translate-y-0.5"
              }`}
              style={{ transform: `rotate(${i === 1 ? 0.5 : -0.5}deg)` }}
            >
              <span className="dateline block">
                Exhibit {["A", "B", "C"][i]}
              </span>
              <span className="font-display text-2xl leading-tight">
                {p.name}
              </span>
              <span className="text-[0.92rem] leading-5 italic">
                {p.teaser}
              </span>
              <span className="mt-auto pt-2 font-mono text-xs uppercase tracking-wide text-[var(--red)]">
                {busy === p.id
                  ? "The court is convening…"
                  : demoDisabled
                    ? "Seized — no key"
                    : "Send to trial →"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8" aria-busy={busy !== null}>
        {signedIn ? (
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              aria-disabled={busy !== null || !geminiKey}
              title={!geminiKey ? demoReason : undefined}
              onClick={() => {
                if (busy !== null || !geminiKey) return;
                runYouTube();
              }}
              className={`inline-block border-4 border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-display text-xl uppercase tracking-wide text-[var(--paper)] ${
                busy !== null || !geminiKey
                  ? "cursor-not-allowed opacity-50"
                  : "transition-transform hover:-translate-y-0.5"
              }`}
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
          <div>
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
              {"Roast my YouTube, sign in with Google"}
            </a>
            <p className="mt-2 max-w-md font-mono text-xs leading-4 text-ink-soft">
              {
                "Optional: only needed for a real roast. The demo above needs no account."
              }
            </p>
          </div>
        )}
        {!oauthConfigured && (
          <p className="mt-2 max-w-md font-mono text-xs leading-4 text-ink-soft">
            {oauthReason}
          </p>
        )}
        <p className="mt-3 max-w-md font-mono text-xs leading-4 text-ink-soft">
          {
            "When you roast a real account, your computed stats and a limited set of video, channel and playlist titles are sent to the AI service that writes the roast. "
          }
          <Link className="underline" href="/privacy">
            See Privacy
          </Link>
          .
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="clipping mt-6 border-2 border-[var(--red)] p-4 text-[0.95rem]"
        >
          <p>{error.text}</p>
          {error.action === "retry" && error.retry && (
            <button
              type="button"
              onClick={error.retry}
              className="mt-3 border-2 border-[var(--ink)] px-4 py-2 font-mono text-xs uppercase tracking-wide transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
            >
              Retry
            </button>
          )}
          {error.action === "signin" && (
            <a
              href="/api/auth/login"
              className="mt-3 inline-block border-2 border-[var(--ink)] px-4 py-2 font-mono text-xs uppercase tracking-wide transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
            >
              Sign in with Google
            </a>
          )}
        </div>
      )}

      <TurnstileWidget ref={turnstile} siteKey={turnstileSiteKey} />
    </div>
  );
}
