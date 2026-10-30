import type { Metadata } from "next";
import { Anton, Source_Serif_4, Geist_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://roasttube.piyushmehta.com",
  ),
  title: "RoastTube: Your YouTube Taste, On The Record",
  description:
    "We read your likes. We did the math. A court of one jury of one found you guilty.",
  // The image comes from app/opengraph-image.tsx, which Next wires into
  // og:image for every route that does not override it (reports do).
  openGraph: {
    type: "website",
    siteName: "RoastTube",
    title: "RoastTube: Your YouTube Taste, On The Record",
    description:
      "We read your likes. We did the math. A court of one jury of one found you guilty.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "RoastTube: Your YouTube Taste, On The Record",
    description:
      "We read your likes. We did the math. A court of one jury of one found you guilty.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookieless page-view counts. The token is public (it only names the site);
  // unset in local dev, so nothing loads and no requests leave the machine.
  const beaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

  return (
    <html
      lang="en"
      className={`${anton.variable} ${sourceSerif.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        {children}
        {beaconToken ? (
          // defer exists only to satisfy next/no-sync-scripts; module scripts
          // are deferred anyway, and the beacon must not block rendering.
          <script
            type="module"
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: beaconToken })}
          />
        ) : null}
      </body>
    </html>
  );
}
