# RoastTube — Implementation Plan

**Goal:** Log in with Google → read YouTube likes/subscriptions/playlists → compute
hard statistics in TypeScript → Gemini writes a roast report, Brain Rot Score,
red flags, and a personality diagnosis.

**Locked decisions**
- Next.js 16 App Router, TypeScript, Tailwind v4, `src/` dir. Already scaffolded.
- **Zero new runtime dependencies.** YouTube Data API v3 and Gemini are called with
  native `fetch`. Reports persist as JSON files under `data/reports/` (no Prisma,
  no DB — YAGNI for localhost-first).
- OAuth is hand-rolled (authorization code + PKCE, ~60 lines) instead of Auth.js,
  because we need the raw `youtube.readonly` access token, not a session library.
- Sessions live in an in-memory `Map` (single localhost process). Access token is
  discarded immediately after collection; only the report is persisted.
- **Demo mode is the primary path.** Three fixture personas produce a real roast
  with only a Gemini key — no Google OAuth client required. This is what makes
  localhost-first viable and what you show in a demo video.
- Watch history is **not** obtainable via any YouTube API (`watchHistoryNotAccessible`).
  Copy says "what you chose to care about", never "watch history".
- Gemini model: `gemini-2.5-flash`, `responseMimeType: application/json` +
  `responseSchema`, harassment/hate safety thresholds lowered to `BLOCK_ONLY_HIGH`
  or default Gemini neuter the roast into mush.

**Architecture**

```
page.tsx ──POST /api/roast {source:"demo"|"youtube", persona?}
                │
   collector ───┤  demo.ts (fixtures)  |  youtube.ts (Data API v3)
                ▼
          signals.ts ──► Signals          (pure TS, deterministic)
                │
           score.ts ───► {score,tier,breakdown}
                │
          gemini.ts ───► RoastReport     (LLM narrates, never invents numbers)
                │
           store.ts ───► data/reports/<id>.json
                │
        /report/[id] ──► ScoreGauge, RoastStream, RedFlagCard, ShareCard
```

**The load-bearing rule:** Gemini sees *computed statistics*, never raw title
dumps. Every joke must be anchored to a real channel name or stat. Tests assert
that.

---

## Task 1 — Types

**Create:** `src/lib/types.ts`

```ts
export type VideoLite = {
  id: string; title: string; channelTitle: string; channelId: string;
  durationSec: number; publishedAt: string; category: string;
}
export type ChannelLite = { id: string; title: string; subscriberCount: number }
export type Signals = {
  totalLikes: number; likesLast7d: number; likesPerDay: number;
  shortsRatio: number; avgVideoLengthSec: number; longestVideoSec: number;
  longestVideoTitle: string; topicEntropy: number;
  categories: Record<string, number>;
  parasocialRatio: number; selfImprovementCount: number;
  ragebaitCount: number; procrastinationCount: number; watchLaterCount: number;
  playlistTitles: string[]; topChannels: { name: string; likes: number }[];
  likeBursts: { date: string; count: number }[];
  subsVsLikes: number; nicheContradictions: string[];
  topChannelTitles: string[]; sampleTitles: string[];
  lateNightCount: number;
}
export type RoastReport = {
  headline: string; roastReport: string; brainrotScore: number;
  brainrotTier: string; redFlags: string[]; personality: string;
  existentialQuestion: string;
  channelRoasts: { channel: string; roast: string }[];
  shareCardLine: string;
}
```

**Test:** none (type-only). Commit.

## Task 2 — Category classifier

**Create:** `src/lib/categories.ts`, `tests/categories.test.ts`

```ts
export const BUCKETS: Record<string, string[]>   // selfImprovement, ragebait,
                                                 // procrastination, parasocial,
                                                 // gaming, shortsCulture, finance,
                                                 // fitness, techHaul, minimalism, news
export function classify(title: string, channelTitle: string, category: string): string[]
```

TDD, write failing tests first:
- `classify("I Tried Waking Up at 5AM for 30 Days", ...)` includes `selfImprovement`
- `classify("I Procrastinated Watching This For 9 Hours", ...)` includes `procrastination`
- `classify("Reacting to the Most Cringe Drama of 2026", ...)` includes `ragebait`
- unknown input returns `[]`

Bucket lists are lowercase substrings. Match on `title + " " + channelTitle`.

## Task 3 — Signal extractor

**Create:** `src/lib/signals.ts`, `tests/signals.test.ts`

```ts
export function extractSignals(
  liked: VideoLite[], subs: ChannelLite[], playlistTitles: string[], watchLater: VideoLite[]
): Signals
```

Rules (exact):
- `shortsRatio` = share of `durationSec <= 60` **or** title contains `#shorts`
- `likesPerDay` = `totalLikes / max(1, days spanned by publishedAt..now)`
- `topicEntropy` = Shannon entropy of channel distribution, normalised by
  `log2(nChannels)`, 0 when nChannels <= 1
- `likeBursts` = likes grouped by `publishedAt` date, entries with `count >= 5`
- `lateNightCount` = likes whose `publishedAt` hour (UTC) is in `[0..5]`
- `subsVsLikes` = `subs.length / max(1, totalLikes)` (lurker index)
- `nicheContradictions` = pairs of buckets that co-occur on >5% of videos and are
  listed as opposed in `OPPOSED_PAIRS` (e.g. `minimalism` × `techHaul`,
  `selfImprovement` × `ragebait`)
- `topChannels` = top 5 by like count; `sampleTitles` = 12 most recent titles

Tests:
- 10 videos, 4 shorts → `shortsRatio === 0.4`
- all videos same channel → `topicEntropy === 0`
- 3 channels evenly → `topicEntropy === 1`
- `selfImprovementCount` counts the fixture productivity videos
- empty inputs → all zeros, no `NaN`, no throw

## Task 4 — Brain Rot Score

**Create:** `src/lib/score.ts`, `tests/score.test.ts`

```ts
export const WEIGHTS = { shortsRatio:25, velocity:20, length:15, ragebait:15,
                         selfImprovement:10, watchLater:10, entropy:5 } as const
export type Tier = "Well Adjusted" | "Mildly Concerning" | "Unhinged"
                 | "Terminal" | "Please Go Outside"
export function brainrotScore(s: Signals): { score: number; tier: Tier;
                                            breakdown: { factor: string; points: number }[] }
```

Sub-scores clamp to 0..1:
- `velocity` = `min(1, likesPerDay / 12)`
- `length` = `1 - min(1, avgVideoLengthSec / 1800)`
- `ragebait` = share of videos classified `ragebait`
- `selfImprovement` = `min(1, selfImprovementCount / 15)`
- `watchLater` = `min(1, watchLaterCount / 40)`

Tiers: `<=20 Well Adjusted`, `<=40 Mildly Concerning`, `<=60 Unhinged`,
`<=80 Terminal`, else `Please Go Outside`.

Tests:
- all-zero Signals → `score === 0`, tier `Well Adjusted`
- worst-case Signals → `score === 100`, tier `Please Go Outside`
- `breakdown` sums to `score` (±1 rounding)
- tier boundaries at exactly 20 / 40 / 60 / 80

## Task 5 — Prompt builder (the product)

**Create:** `src/lib/prompt.ts`, `tests/prompt.test.ts`

```ts
export const ROAST_SCHEMA = { /* Gemini responseSchema, all 9 fields */ }
export const SAFETY = [ /* HARM_CATEGORY_HARASSMENT/HATE_SPEECH: BLOCK_ONLY_HIGH */ ]
export function buildSystemPrompt(): string
export function buildUserPrompt(s: Signals, r: {score:number;tier:string}): string
```

System prompt must contain, verbatim in intent:
- never invent numbers or channels; use only what is provided
- every joke anchored to a named channel, title, or stat
- target contradictions between what they watch and what they claim to value
- no advice, no hedging, no "as an AI", no softening
- roast behaviour and taste, never appearance, health, or relationships
- end with one question that lands like a punch

Tests:
- `buildUserPrompt` output contains every name in `s.topChannels`
- output contains the score and tier
- output contains each `nicheContradictions` entry
- system prompt contains `"never invent"` and `"no advice"`
- `ROAST_SCHEMA.required.length === 9`

## Task 6 — Gemini client

**Create:** `src/lib/gemini.ts`

```ts
export async function roast(s: Signals, r: ScoreResult): Promise<RoastReport>
```

Native `fetch` to
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
`x-goog-api-key: GEMINI_API_KEY`, `generationConfig: { temperature: 1.0,
responseMimeType: "application/json", responseSchema: ROAST_SCHEMA,
safetySettings: SAFETY }`. Parse `candidates[0].content.parts[0].text` as JSON.
Throw a readable error naming the HTTP status + API message on failure.
No test (network) — the prompt builder is what's tested.

## Task 7 — YouTube collector

**Create:** `src/lib/youtube.ts`

Native `fetch` against `https://www.googleapis.com/youtube/v3`:
- `channels.list?part=contentDetails,snippet&mine=true` → `relatedPlaylists.likes`
- `playlistItems.list?part=contentDetails,snippet&maxResults=50` ×4 pages of likes
- `videos.list?id=…` in 50-id batches → `contentDetails.duration` (ISO-8601 → sec),
  `snippet.publishedAt`, `snippet.categoryId`, `snippet.channelTitle`
- `subscriptions.list?part=snippet&mine=true&maxResults=50`
- `playlists.list?part=snippet&mine=true&maxResults=50` → titles
- `playlistItems.list` on `relatedPlaylists.watchLater` → count only
- `QUOTA_BUDGET = 20` units; refuse before calling if projected cost exceeds it
- map `categoryId` → human label in `CATEGORIES`
- `403` with `reason: "watchHistoryNotAccessible"` → clear message, never crash

## Task 8 — OAuth (hand-rolled)

**Create:** `src/lib/oauth.ts`, `src/app/api/auth/login/route.ts`,
`src/app/api/auth/callback/route.ts`, `src/app/api/auth/logout/route.ts`

- scope `https://www.googleapis.com/auth/youtube.readonly`
- state + PKCE in an httpOnly cookie; in-memory `Map<sessionId, {token, expiresAt}>`
- `RT_COOKIES=true` for localhost
- if `GOOGLE_CLIENT_ID` unset → `/api/auth/login` returns 501 with
  `{ error: "oauth_not_configured" }` and the UI shows demo mode instead

## Task 9 — Store

**Create:** `src/lib/store.ts`

`saveReport(report, signals, score) → id` (8-char base36), `getReport(id)`,
`listReports(limit)`, `deleteReport(id)`. JSON files in `data/reports/`,
`data/` gitignored.

## Task 10 — Demo personas

**Create:** `src/lib/demo.ts`

Three fixtures as `VideoLite[]` + subs + playlist titles, built to be funny and to
exercise every bucket:
- `lurker` — 300 subs, 11 likes, 40 productivity videos, "Watch Later" 212
- `gremlin` — 240 likes in 7 days, 92% shorts, 3am bursts
- `essay-hoarder` — 4h11m liked at 02:40, minimalism channel + 14 tech-haul channels

`getDemoPersona(name)` returns the collector-shaped payload.

## Task 11 — API route

**Create:** `src/app/api/roast/route.ts`

`POST {source:"demo", persona}` or `{source:"youtube"}` → collect → signals →
score → Gemini → save → `{ id, report, signals, score }`.
Rate limit: 3/hour per IP, in-memory. Gemini failure → 502 with the API message.

## Task 12 — UI

**Create:** `src/app/page.tsx`, `src/app/report/[id]/page.tsx`,
`src/components/{ScoreGauge,RoastStream,RedFlagCard,ChannelRoasts,ShareCard}.tsx`

- Landing: headline, three demo persona buttons, "Roast my YouTube" (disabled with
  a reason when OAuth is unconfigured).
- Report: score gauge (inline SVG arc), tier, headline, streaming roast body,
  3 red-flag cards, per-channel roasts, existential question last, share card
  (copy text + download PNG via canvas).
- Dark, high-contrast, one accent colour. No filler sections.

## Task 13 — Verify + ship

- `npm test` green, `npx tsc --noEmit` clean, `npm run build` clean.
- `npm run dev` → run all three demo personas, confirm each roast names real
  fixture channels and contains no invented numbers.
- README: what it is, the watch-history caveat, setup, env vars, removal of data.
- `git init` already done by create-next-app → create **private** GitHub repo with
  `gh repo create roasttube --private --source --push`.
