import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — RoastTube",
  description: "What RoastTube reads, what it keeps, and what it never does.",
};

export default function Privacy() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <header>
        <div className="flex items-baseline justify-between gap-4 border-b-4 border-[var(--ink)] pb-1">
          <span className="dateline">The fine print</span>
          <span className="dateline">Effective 17 October 2026</span>
        </div>
        <h1 className="masthead py-3 text-center text-[17vw] leading-[0.85] sm:text-8xl">
          PRIVACY
        </h1>
        <div className="rule-double" />
      </header>

      <section className="pt-8">
        <p className="dateline mb-3">Short version first, lawyer version below</p>
        <h2 className="headline text-3xl sm:text-5xl">THE SHORT VERSION</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          RoastTube reads your liked videos, subscriptions, and playlist titles
          once, with your permission, to write one comedy roast. It never
          touches your watch history (YouTube does not allow that anyway). Your
          Google token is not kept on our servers, nothing is sold to anyone,
          and the only thing that sticks around is the roast itself, so the
          link keeps working.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">WHAT WE READ</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          When you click &ldquo;Roast my YouTube&rdquo; and sign in with Google,
          you grant one permission: <strong>youtube.readonly</strong>, the
          read-only scope of the YouTube Data API. With it, RoastTube fetches:
        </p>
        <ul className="mt-4 max-w-2xl list-disc space-y-1 pl-5 text-lg leading-7">
          <li>the videos you have liked (titles, channels, categories, lengths);</li>
          <li>the channels you are subscribed to (first 50);</li>
          <li>the titles of your playlists.</li>
        </ul>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          That is the whole list. Google hands us no email address, no profile,
          no contacts, no watch history — just a token for the items above.
          The collected evidence is turned into numbers and prompts and sent to
          Google&apos;s Gemini model to generate the roast.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">WHAT WE KEEP</h2>
        <ul className="mt-4 max-w-2xl list-disc space-y-1 pl-5 text-lg leading-7">
          <li>
            <strong>The roast.</strong> The finished report is stored under a
            random eight-character id so shareable links keep working. It
            contains the roast text, the score, and the video and channel
            titles it was built from.
          </li>
          <li>
            <strong>Your session.</strong> While you use the site, the Google
            access token sits in a signed, encrypted cookie on your own
            device. It expires within an hour, it is never written to a
            database, and signing out deletes it. We never request or keep a
            refresh token.
          </li>
        </ul>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">WHAT WE NEVER DO</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          We do not sell, rent, or share your data with anyone. There are no
          ads, no ad trackers, and no analytics profiles. Our hosting provider
          (Cloudflare) keeps standard request logs to run and protect the
          site, as any host does.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">
          GOOGLE&apos;S RULES
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          RoastTube&apos;s use of information received from Google APIs will
          adhere to the{" "}
          <a
            className="underline decoration-1 underline-offset-2"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. See also Google&apos;s{" "}
          <a
            className="underline decoration-1 underline-offset-2"
            href="https://policies.google.com/privacy"
          >
            Privacy Policy
          </a>{" "}
          and YouTube&apos;s{" "}
          <a
            className="underline decoration-1 underline-offset-2"
            href="https://www.youtube.com/t/terms"
          >
            Terms of Service
          </a>
          .
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">YOUR CONTROLS</h2>
        <ul className="mt-4 max-w-2xl list-disc space-y-1 pl-5 text-lg leading-7">
          <li>
            Revoke RoastTube&apos;s access at any time at{" "}
            <a
              className="underline decoration-1 underline-offset-2"
              href="https://myaccount.google.com/permissions"
            >
              myaccount.google.com/permissions
            </a>
            .
          </li>
          <li>Signing out deletes the session cookie on this device.</li>
          <li>
            To delete a stored roast, email its case number to{" "}
            <a
              className="underline decoration-1 underline-offset-2"
              href="mailto:me@piyushmehta.com"
            >
              me@piyushmehta.com
            </a>
            .
          </li>
        </ul>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">CHILDREN</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          RoastTube is for grown-ups with strong opinions and mild case files.
          It is not directed to children under 13.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">CONTACT</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          Questions, deletions, or objections to the verdict:{" "}
          <a
            className="underline decoration-1 underline-offset-2"
            href="mailto:me@piyushmehta.com"
          >
            me@piyushmehta.com
          </a>
          .
        </p>

        <p className="dateline mt-10">
          RoastTube is not affiliated with, endorsed by, or sponsored by
          YouTube or Google. YouTube is a trademark of Google LLC.
        </p>
      </section>

      <footer className="mt-14">
        <div className="rule-thick" />
        <p className="dateline mt-3 text-center">
          <Link className="underline" href="/">
            ← Back to the front page
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
