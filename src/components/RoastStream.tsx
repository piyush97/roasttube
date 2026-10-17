"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// useLayoutEffect warns on the server; the animation only runs client-side and
// must hide the text before the browser paints, so use it where it exists.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// The typewriter is an enhancement for the ?fresh=1 arrival only. Cap it so a
// long roast never makes the reader wait: 1.5s hard ceiling.
const MAX_MS = 1500;
const MIN_MS = 550;

/**
 * Server-renders the full roast text always, so saved links and no-JS renders
 * show everything at first paint. When the report page is reached with
 * `?fresh=1` (the client appends it right after a fresh generation), the text
 * types in once, capped at 1.5s; a click or any keypress finishes it instantly.
 * `prefers-reduced-motion: reduce` never animates. The param is stripped from
 * the URL when the reveal completes, keeping any other params and the hash.
 */
export function RoastStream({
  text,
  fresh = false,
}: {
  text: string;
  fresh?: boolean;
}) {
  // null = fully revealed (SSR, no-JS, reduced motion, and after completion).
  const [revealed, setRevealed] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!fresh || text.length === 0) return;

    const stripFresh = () => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("fresh")) return;
      url.searchParams.delete("fresh");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash
      );
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stripFresh();
      return;
    }

    setRevealed(0);

    const total = text.length;
    const duration = Math.min(MAX_MS, Math.max(MIN_MS, total * 1.6));
    let start: number | null = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("click", finish, true);
      document.removeEventListener("keydown", finish, true);
      setRevealed(null);
      stripFresh();
    };

    // A click or any key press skips straight to the verdict.
    document.addEventListener("click", finish, true);
    document.addEventListener("keydown", finish, true);

    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      if (progress >= 1) {
        finish();
        return;
      }
      setRevealed(Math.ceil(progress * total));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("click", finish, true);
      document.removeEventListener("keydown", finish, true);
    };
  }, [fresh, text]);

  const paragraphs = text.split(/\n\s*\n|\s*\bParagraph\s+\d+\s*:\s*/i);
  const totalChars = paragraphs.reduce((n, p) => n + p.length, 0);
  let budget = revealed;

  return (
    <div
      lang="en"
      className="hyphens-auto text-[1.06rem] leading-7 [&>p]:mb-4 [&>p:last-child]:mb-0"
    >
      {paragraphs.map((p, i) => {
        const slice = budget === null ? p : p.slice(0, Math.max(0, budget));
        if (budget !== null) budget -= p.length;
        if (!slice) return null;
        return (
          <p
            key={i}
            className={
              i === 0
                ? "first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-6xl first-letter:leading-[0.8]"
                : ""
            }
          >
            {slice}
          </p>
        );
      })}
      {revealed !== null && revealed < totalChars && (
        <span
          className="inline-block h-5 w-2.5 animate-pulse bg-[var(--red)] align-middle"
          aria-hidden
        />
      )}
    </div>
  );
}
