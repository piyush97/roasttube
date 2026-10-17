"use client";

import { useEffect, useState } from "react";

export function RoastStream({ text }: { text: string }) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    // All state updates happen inside the timer callback — never synchronously
    // in the effect body (avoids cascading renders). Reduced motion = one tick.
    let i = 0;
    const step = reduced
      ? text.length
      : Math.max(2, Math.round(text.length / 400));
    const id = setInterval(() => {
      i += step;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, reduced ? 0 : 24);
    return () => clearInterval(id);
  }, [text]);

  return (
    <div className="text-[1.06rem] leading-7 [&>p]:mb-4 [&>p:last-child]:mb-0">
      {shown.split("\n\n").map((p, i) => (
        <p key={i} className={i === 0 ? "first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-6xl first-letter:leading-[0.8]" : ""}>
          {p}
        </p>
      ))}
      {shown.length < text.length && (
        <span className="inline-block h-5 w-2.5 animate-pulse bg-[var(--red)] align-middle" aria-hidden />
      )}
    </div>
  );
}
