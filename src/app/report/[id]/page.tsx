import { notFound } from "next/navigation";
import Link from "next/link";
import { getReport } from "@/lib/store";
import { ScoreGauge } from "@/components/ScoreGauge";
import { RoastStream } from "@/components/RoastStream";
import { RedFlagCard } from "@/components/RedFlagCard";
import { ChannelRoasts } from "@/components/ChannelRoasts";
import { ShareCard } from "@/components/ShareCard";

// Reads a JSON file from disk per request; nothing to prerender.
export const instant = false;

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stored = await getReport(id);
  if (!stored) notFound();

  const { report } = stored;
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
          <span className="dateline">
            <Link href="/" className="hover:text-[var(--red)]">
              ← Front page
            </Link>
          </span>
          <span className="dateline">{today}</span>
          <span className="dateline">
            {stored.source === "demo" ? "Special demo edition" : "Exclusive"}
          </span>
        </div>
        <h1 className="masthead py-3 text-center text-[13vw] leading-[0.85] sm:text-7xl">
          THE VERDICT
        </h1>
        <div className="rule-double" />
      </header>

      <div className="pt-8 text-center">
        <span className="stamp stamp-slam text-2xl sm:text-3xl">
          {report.brainrotTier}
        </span>
      </div>

      <h2 className="headline mt-6 text-center text-[2.2rem] leading-[1] sm:text-6xl">
        {report.headline}
      </h2>
      <p className="dateline mt-3 text-center">
        Our correspondent was present for all of it and is legally required not
        to comment
      </p>

      <section className="mt-10">
        <ScoreGauge score={report.brainrotScore} tier={report.brainrotTier} />
      </section>

      <section className="mt-12">
        <div className="rule-thick" />
        <div className="mt-6 text-justify md:columns-2 md:gap-10">
          <RoastStream text={report.roastReport} />
        </div>
      </section>

      {report.redFlags.length > 0 && (
        <section className="mt-14">
          <h2 className="masthead text-4xl">Red flags, plural</h2>
          <div className="rule-double mt-2 mb-6" />
          <div className="grid gap-6 sm:grid-cols-3">
            {report.redFlags.map((flag, i) => (
              <RedFlagCard key={i} flag={flag} index={i} />
            ))}
          </div>
        </section>
      )}

      {report.channelRoasts.length > 0 && (
        <section className="mt-14">
          <h2 className="masthead text-4xl">The usual suspects</h2>
          <div className="rule-double mt-2 mb-2" />
          <ChannelRoasts roasts={report.channelRoasts} />
        </section>
      )}

      <section className="mt-14">
        <h2 className="masthead text-4xl">The diagnosis</h2>
        <div className="rule-double mt-2 mb-6" />
        <p className="text-[1.06rem] leading-7">{report.personality}</p>
      </section>

      <section className="mt-16 text-center">
        <div className="rule-thick" />
        <blockquote className="mx-auto max-w-2xl py-10">
          <p className="font-display text-[1.7rem] leading-tight sm:text-4xl">
            {report.existentialQuestion}
          </p>
        </blockquote>
        <div className="rule-thick" />
      </section>

      <section className="mt-12">
        <ShareCard
          id={stored.id}
          line={report.shareCardLine}
          score={report.brainrotScore}
          tier={report.brainrotTier}
        />
      </section>

      <footer className="mt-14">
        <div className="rule-thick" />
        <p className="dateline mt-3 text-center">
          Case no. {stored.id} — filed {new Date(stored.createdAt).toUTCString()}
          {stored.source === "demo" ? " · fabricated defendant, real math" : ""}
        </p>
      </footer>
    </main>
  );
}
