import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy | RoastTube",
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
        <p className="dateline mb-3">The whole record, in plain language</p>

        <h2 className="headline text-3xl sm:text-5xl">WHAT ROASTTUBE DOES</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          RoastTube is a free entertainment site operated by Piyush Mehta.
          With your permission it reads your YouTube lists (likes,
          subscriptions, and playlists), computes a Brain Rot Score, and has
          an AI model write a comedy roast that you can share by link. The
          demo personas run on invented data and need no account or sign-in.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">
          GOOGLE ACCOUNT AND YOUTUBE DATA
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          Signing in requests exactly one permission:{" "}
          <strong>youtube.readonly</strong>, the read-only scope of the YouTube
          Data API. For each roast, RoastTube fetches:
        </p>
        <ul className="mt-4 max-w-2xl list-disc space-y-1 pl-5 text-lg leading-7">
          <li>
            your liked videos, up to 200, with titles, channel names,
            categories, lengths, and publish dates;
          </li>
          <li>
            your subscriptions, the first 50, with titles and subscriber
            counts;
          </li>
          <li>your playlist titles, up to 50;</li>
          <li>
            the first 50 titles from Watch Later, only when YouTube exposes
            them through the API.
          </li>
        </ul>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          That is the whole list. We do not receive your name, email address,
          profile, contacts, watch history, comments, or uploads. We never
          request or store a refresh token, and the access token is used for
          one collection pass.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">TECHNICAL DATA</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          Our host, Cloudflare, processes standard request data such as your
          IP address to serve the site and protect it. We use the IP address
          for rate limiting, currently 3 roast requests per hour per address,
          and to run Cloudflare Turnstile, the bot check on demo requests. Two
          cookies are set: <strong>rt_session</strong>, sealed and HttpOnly,
          which expires within 1 hour, and <strong>rt_oauth</strong>, which
          expires in 10 minutes and is scoped to the /api/auth path. There are
          no advertising or tracking cookies. Page views are counted in
          aggregate by Cloudflare Web Analytics, which sets no cookies and does
          not follow you across sites.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">HOW WE USE IT</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          Solely to produce your roast, store it so its link keeps working,
          and stop abuse of the service. There is no advertising and no
          profiling, and the only measurement is the cookieless page-view
          count described above.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">
          STORAGE AND RETENTION
        </h2>
        <ul className="mt-4 max-w-2xl list-disc space-y-1 pl-5 text-lg leading-7">
          <li>
            <strong>Reports.</strong> Stored in Cloudflare Workers KV under a
            random eight-character id and kept until you ask us to delete
            them. There is no automatic expiry. A stored report contains the
            roast text, the score, the computed statistics, and the titles it
            was built from.
          </li>
          <li>
            <strong>Rate-limit counters.</strong> Keys of the form
            rl:&lt;ip&gt; are kept for about 1 hour.
          </li>
          <li>
            <strong>Daily budget counter.</strong> Kept for 48 hours.
          </li>
          <li>
            <strong>Demo cache.</strong> Kept for 1 hour.
          </li>
          <li>
            <strong>Session.</strong> The access token is never stored on our
            servers. It lives only in the sealed cookie on your device and
            expires within an hour.
          </li>
        </ul>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">SHARING</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          Only two organizations see any of it, and only to make the site
          work: Google (the YouTube Data API, which reads your lists, and the
          Gemini model that writes the roast) and Cloudflare (hosting, Workers
          KV storage, and Turnstile, the bot check). Your data is never sold or
          shared for advertising or surveillance, never sent to data brokers,
          and never used for credit or lending decisions.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">
          THE AI THAT WRITES THE ROAST
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          The prompt sent to the model contains computed statistics plus a
          limited set of titles and names: the title of your longest liked
          video, up to 8 recent titles from your top channel, up to 12
          liked-video titles, your playlist titles, your top 5 channel names
          with like counts, and your category counts. It never receives video
          or channel IDs, your account identity, or raw API responses.
        </p>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          The model runs on Google&apos;s Gemini, on its paid tier, where Google
          does not use prompts or responses to train its models (Gemini API
          Terms of Service, Paid Services). A fallback model may run on
          Cloudflare Workers AI, where inputs and outputs are not retained and
          are not used to train AI models (Cloudflare Workers AI data usage
          commitments).
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">
          GOOGLE LIMITED USE
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          RoastTube&apos;s use of information received from Google APIs will
          adhere to{" "}
          <a
            className="underline decoration-1 underline-offset-2"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          In plain terms: Google user data is not used to train AI models, it
          is not transferred to anyone beyond the service providers that
          deliver the roast, and no one reads it except when security, abuse
          prevention, or the law requires it. See also Google&apos;s{" "}
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

        <h2 className="headline mt-10 text-3xl sm:text-5xl">YOUR RIGHTS</h2>
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
          <li>Signing out deletes the session cookie on your device.</li>
          <li>
            To delete a stored report, email its case number, the part of its
            link after /report/, to{" "}
            <a
              className="underline decoration-1 underline-offset-2"
              href="mailto:contact@piyushmehta.com"
            >
              contact@piyushmehta.com
            </a>
            . We delete the stored report, including the roast text, score,
            statistics, and titles, and confirm within 30 days.
          </li>
        </ul>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">SECURITY</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          Traffic is encrypted with TLS everywhere. Stored reports sit in
          Cloudflare Workers KV under Cloudflare&apos;s access controls. The
          Google access token exists only inside an AES-GCM-sealed, HttpOnly,
          SameSite=Lax cookie on your device. Sign-in uses PKCE, and no
          refresh token is ever requested or kept. Report links are public by
          nature: anyone with the link can read the case.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">CHILDREN</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          RoastTube is for grown-ups with strong opinions and mild case files.
          The AI model in our chain requires adults: the site is not directed
          to anyone under 18, and we do not knowingly collect information from
          anyone under 18.
        </p>

        <h2 className="headline mt-10 text-3xl sm:text-5xl">CHANGES</h2>
        <p className="mt-4 max-w-2xl text-lg leading-7">
          This policy may change as the site changes. When it does, we update
          this page and move the effective date at the top. Continuing to use
          RoastTube after a change means you accept the updated policy.
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
