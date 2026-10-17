"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <header>
        <div className="flex items-baseline justify-between gap-4 border-b-4 border-[var(--ink)] pb-1">
          <span className="dateline">Court adjourned</span>
          <span className="dateline">Mistrial declared</span>
        </div>
        <h1 className="masthead py-3 text-center text-[13vw] leading-[0.85] sm:text-7xl">
          THE PRESSES JAMMED
        </h1>
        <div className="rule-double" />
      </header>

      <section className="pt-8 text-center">
        <span className="stamp stamp-slam text-2xl sm:text-3xl">Mistrial</span>
        <h2 className="headline mt-6 text-[2.2rem] leading-[1] sm:text-5xl">
          This page could not be set in type
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-7">
          Something broke on the press floor while this page was being printed.
          The fault is on our side, not yours. Run the page again, and if the
          machinery stays jammed, the front page still works.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-block cursor-pointer border-4 border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-display text-xl uppercase tracking-wide text-[var(--paper)] transition-transform hover:-translate-y-0.5"
          >
            Retry this page
          </button>
          <Link
            href="/"
            className="inline-block border-4 border-[var(--ink)] px-6 py-3 font-display text-xl uppercase tracking-wide transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
          >
            ← Front page
          </Link>
        </div>
      </section>

      <footer className="mt-14">
        <div className="rule-thick" />
        <p className="dateline mt-3 text-center">
          The error has been noted in the margin. Objections:{" "}
          <a className="underline" href="mailto:contact@piyushmehta.com">
            contact@piyushmehta.com
          </a>
        </p>
      </footer>
    </main>
  );
}
