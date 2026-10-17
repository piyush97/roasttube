import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Case dismissed · RoastTube",
  description: "This case number is not on file in the court of public opinion.",
};

export default function NotFound() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <header>
        <div className="flex items-baseline justify-between gap-4 border-b-4 border-[var(--ink)] pb-1">
          <span className="dateline">Notice of dismissal</span>
          <span className="dateline">Case no. 404</span>
        </div>
        <h1 className="masthead py-3 text-center text-[17vw] leading-[0.85] sm:text-8xl">
          CASE DISMISSED
        </h1>
        <div className="rule-double" />
      </header>

      <section className="pt-8 text-center">
        <span className="stamp stamp-slam text-2xl sm:text-3xl">Not on file</span>
        <h2 className="headline mt-6 text-[2.2rem] leading-[1] sm:text-5xl">
          This case number is not on file
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-7">
          The clerk checked every drawer. Twice. Either the link picked up a
          typo on the way here, or the file was never opened. No verdict today.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-block border-4 border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-display text-xl uppercase tracking-wide text-[var(--paper)] transition-transform hover:-translate-y-0.5"
          >
            ← Front page
          </Link>
          <Link
            href="/?run=1"
            className="inline-block border-4 border-[var(--ink)] px-6 py-3 font-display text-xl uppercase tracking-wide transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
          >
            Get your own verdict
          </Link>
        </div>
      </section>

      <footer className="mt-14">
        <div className="rule-thick" />
        <p className="dateline mt-3 text-center">
          <Link className="underline" href="/privacy">
            Privacy
          </Link>
          {" · "}
          <Link className="underline" href="/terms">
            Terms
          </Link>
        </p>
      </footer>
    </main>
  );
}
