# RoastTube

Sign in with Google. RoastTube reads your YouTube **likes, subscriptions, playlists and
Watch Later count**, computes hard stats, and a Gemini model writes a brutal tabloid roast
report with a **Brain Rot Score**, red flags, and a personality diagnosis.

It cannot read your watch history — no API can. RoastTube never claims to. It roasts
what you *chose to care about*: what you liked, who you subscribe to, what you hoard.

## Demo (no Google account needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000 and hit one of the three demo personas — **lurker**,
**gremlin**, **essay-hoarder**. No credentials required; only `GEMINI_API_KEY` is needed
for the roast text itself.

## Setup (real Google login)

1. `cp .env.example .env.local`
2. Run the OAuth wizard — it walks you through Google Cloud Console and writes
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` into `.env.local`:

   ```bash
   ./scripts/setup-google-oauth.sh
   ```

3. Add your `GEMINI_API_KEY` (aistudio.google.com) to `.env.local`.
4. `npm run dev` → Sign in with Google.

The app stays in Google OAuth **Testing** mode: expect the unverified-app warning
(Advanced → Continue). That's the intended localhost posture.

## Env vars

| Var | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Roast generation |
| `GEMINI_MODEL` | no | Override default `gemini-3.5-flash` (auto-falls back to `gemini-flash-lite-latest` on 429/503) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for real login | OAuth; unset → demo mode only |
| `NEXT_PUBLIC_APP_URL` | no | Base URL, default `http://localhost:3000` |
| `RT_COOKIES` | no | `true` forces Secure cookies on localhost to test the production cookie path |

## Data & removal

- Reports are JSON files in `data/reports/` (gitignored). Nothing else is persisted.
- The YouTube access token lives in an in-memory session map only; it dies with the server.
- Delete a report: `rm data/reports/<id>.json` — or all: `rm -rf data/reports`.
- Roast rate limit: 3/hour/IP. YouTube quota budget: 20 units/run (a full run ≈ 9).

## Tests

```bash
npm test        # node --test, 50 tests
npx tsc --noEmit
```
