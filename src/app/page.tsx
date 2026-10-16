import { connection } from "next/server";
import { isOAuthConfigured } from "@/lib/oauth";
import { RoastButtons } from "@/components/RoastButtons";

// Dateline shows today's date; render per request instead of at build.
export const instant = false;

export default async function Home() {
  await connection(); // dateline is today's date — render per request, not at build
  const oauthConfigured = isOAuthConfigured();
  const geminiKey = Boolean(process.env.GEMINI_API_KEY);
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <header>
        <div className="flex items-baseline justify-between gap-4 border-b-4 border-[var(--ink)] pb-1">
          <span className="dateline">Vol. I — No. 1</span>
          <span className="dateline">{today}</span>
          <span className="dateline hidden sm:inline">Price: your dignity</span>
        </div>
        <h1 className="masthead py-3 text-center text-[17vw] leading-[0.85] sm:text-8xl">
          ROASTTUBE
        </h1>
        <div className="rule-double" />
      </header>

      <section className="pt-8">
        <p className="dateline mb-3">
          Extra! Extra! Local reader volunteers ownness; regrets begin immediately
        </p>
        <h2 className="headline text-[2.6rem] leading-[0.95] sm:text-7xl">
          WE READ YOUR LIKES.
          <br />
          <span className="text-[var(--red)]">WE DID THE MATH.</span>
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-7">
          A court of one, jury of one, found you guilty on all counts of taste.
          RoastTube pulls what you{" "}
          <em>chose to care about</em> — your liked videos, subscriptions and
          playlists — computes a Brain Rot Score from hard numbers, then lets a
          model with no manners and perfect evidence explain you to yourself.
        </p>
        <p className="mt-4 max-w-2xl text-[0.95rem] italic leading-6 text-ink-soft">
          In fairness: YouTube does not let anyone read your watch history, so
          we don&apos;t pretend to. We only prosecute what you already made
          public with a thumbs. Your token is discarded the moment the evidence
          is collected.
        </p>
      </section>

      <RoastButtons oauthConfigured={oauthConfigured} geminiKey={geminiKey} />

      <footer className="mt-14">
        <div className="rule-thick" />
        <p className="dateline mt-3 text-center">
          RoastTube — entertainment, barely. Runs entirely on your machine.
          Reports live in ./data/reports; delete the folder, evidence gone.
        </p>
      </footer>
    </main>
  );
}
