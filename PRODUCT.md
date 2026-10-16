# PRODUCT.md — RoastTube

## What this is
Web app that roasts your YouTube taste. Google login → pulls likes/subscriptions/
playlists → hard-computed stats in TypeScript → Gemini writes a brutal roast
report with a Brain Rot Score, red flags, and a personality diagnosis.

## Why it exists
Shareable, rum-worthy self-deprecation. The roast must feel earned: every joke
is anchored to a real channel, title, or statistic from the user's own data.

## Audience
Casual adults 20–40 who suspect their YouTube habits are bad and want proof,
plus their friends who'll want to see it. Not for professionals; no enterprise.

## Voice / tone
Brutal, funny, specific. Tabloid energy. No hedging, no advice, no "as an AI".
Roasts the choices, never the person's appearance, health, or relationships.

## Key workflows
1. Landing → pick a demo persona (lurker / gremlin / essay-hoarder) or sign in
   with Google (OAuth stays in Testing mode; localhost first).
2. POST /api/roast → collect → signals → score → Gemini → saved report.
3. Report page at /report/[id]: score gauge, tier, headline, roast body,
   red-flag cards, per-channel roasts, share card.

## Constraints
- YouTube API can't read watch history; copy says "what you chose to care about".
- OAuth in Google Testing mode; demo path must work without Google credentials.
- Gemini key required for any roast (demo personas included).

## Platform
web (Next.js 16 App Router, Tailwind v4)

## Visual direction (confirmed by user)
Tabloid gossip rag: newsprint, red stamps, halftone dots, screaming headlines.
Feels like being publicly roasted in a penny dreadful. Screenshots must look
shareable.
