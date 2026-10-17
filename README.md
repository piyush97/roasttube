<p align="center"><img src="docs/screenshots/home.png" alt="RoastTube front page: a tabloid masthead reading WE READ YOUR LIKES. WE DID THE MATH." width="720"></p>

# RoastTube

Sign in with Google. RoastTube reads your YouTube likes, subscriptions, playlists and Watch Later, computes hard statistics in TypeScript, and lets Gemini write a tabloid roast: a **Brain Rot Score**, red flags, channel-by-channel takedowns, a personality diagnosis, and one closing question you will think about in the shower.

YouTube does not expose watch history to any API, and RoastTube never pretends otherwise. It roasts what you *chose to care about*: the videos you liked, the channels you follow, the playlists you hoard.

## The report

<p align="center"><img src="docs/screenshots/report-verdict.png" alt="The verdict page for a demo persona: stamp reading Mildly Concerning, a Brain Rot Score gauge at 29, and the roast in two newspaper columns" width="600"></p>

A demo persona (The Lurker) after trial. Every number in a roast traces back to the victim's own data, and the score is computed in code, so the model cannot flatter you.

<p align="center"><img src="docs/screenshots/report-details.png" alt="Red flag cards, a table of channel roasts, the personality diagnosis, and a share card with copy and download buttons" width="600"></p>

Red flags, the usual suspects, the diagnosis, and a share card you can screenshot or download as PNG.

## What it does

- **Collects** your liked videos (up to 200), subscriptions, named playlists, and Watch Later count through the YouTube Data API v3, inside a 20-unit quota budget. A full run spends about 9.
- **Computes** the signals: Shorts ratio, average and longest liked-video length, topic entropy, category mix, late-night likes, binge days, self-improvement videos liked (vs. completed: zero), ragebait, procrastination bait, Watch Later hoard, lurker index, and contradictions between playlist names and actual behavior.
- **Scores** with fixed weights, and the hard-computed score always overrides whatever the model self-reports.
- **Writes** a 3 to 5 paragraph roast, red flags, one line per top channel, a diagnosis, a closing question, and a shareable one-liner. Gemini receives only the computed stats, never your raw account.
- **Humanizes** the text before it ships: a normalizer strips the tells of AI writing (em dashes, literal "Paragraph 2:" labels) and the system prompt bans the stock phrases and sentence shapes models fall back on.
- **Stores** each report as a JSON file under `data/reports/`, served at `/report/<id>`, with a PNG share card.

## The Brain Rot Score

| Weight | Signal |
| --- | --- |
| 25 | Shorts ratio |
| 20 | Likes per day (velocity) |
| 15 | Average video length (shorter is worse) |
| 15 | Ragebait liked |
| 10 | Self-improvement videos liked and never acted on |
| 10 | Watch Later hoard size |
| 5 | Topic entropy |

| Score | Tier |
| --- | --- |
| 20 and under | Well Adjusted |
| 21 to 40 | Mildly Concerning |
| 41 to 60 | Unhinged |
| 61 to 80 | Terminal |
| 81 and up | Please Go Outside |

Weights live in `src/lib/score.ts` and are easy to argue with. Bring data.

## Demo mode

Three fabricated defendants ship in the repo (The Lurker, The Gremlin, The Essay Hoarder). No Google account and no OAuth client are needed. You do need a free Gemini API key.

```bash
npm install
cp .env.example .env.local   # paste your GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000 and send a persona to trial.

## Real Google login

The app stays in Google OAuth **Testing** mode on purpose for localhost use: 100 test users, no verification review, and a warning screen you click past (Advanced, then Continue). The wizard handles the Google Cloud side and writes the credentials for you:

```bash
./scripts/setup-google-oauth.sh
```

It walks through creating a project, enabling the YouTube Data API v3, configuring the consent screen, creating a Web application OAuth client with the redirect URI `http://localhost:3000/api/auth/callback/google`, and writing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env.local`. The only scope requested is `youtube.readonly`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Roast generation. Free key from Google AI Studio. |
| `GEMINI_MODEL` | no | Overrides the default `gemini-3.5-flash`. Falls back to `gemini-flash-lite-latest` on 429 or 503 automatically. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for real login | Without them the app runs demo mode only. |
| `NEXT_PUBLIC_APP_URL` | no | Base URL, defaults to `http://localhost:3000`. |
| `RT_COOKIES` | no | `true` forces Secure cookies on localhost to exercise the production cookie path. |

## How it works

1. **OAuth.** Hand-rolled authorization code flow with PKCE (S256), about 60 lines in `src/lib/oauth.ts`. The access token lives in an in-memory session store and is never written to disk.
2. **Collection.** `src/lib/youtube.ts` walks likes, subscriptions, playlists and Watch Later with a hard quota budget and clear errors for locked playlists.
3. **Signals and score.** Pure functions in `src/lib/signals.ts` and `src/lib/score.ts` turn the collected data into numbers and the Brain Rot Score. Both are unit-tested against fixtures.
4. **Roast.** `src/lib/prompt.ts` builds a stats-only prompt with a strict JSON response schema. `src/lib/gemini.ts` calls the Gemini REST API, retries on quota pressure, and falls back to a lighter model.
5. **Humanizer pass.** The generated text is normalized: em dashes become commas or sentence breaks, stray "Paragraph N:" labels become real paragraph breaks. The writing rules in the system prompt follow [Wikipedia's Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing).
6. **Report.** Stored as JSON in `data/reports/`, rendered as a newspaper page with a typewriter effect, a share card, and a copyable link.

## Tests

```bash
npm test          # node --test, 58 tests
npx tsc --noEmit  # types
npm run lint      # eslint
npm run build     # production build
```

The suite covers scoring math, signal extraction, category classification, prompt shape, report storage, demo personas, and the text normalizers. No test framework is installed; Node runs TypeScript directly.

## Development notes

- **No new runtime dependencies**, please. YouTube and Gemini are called with native `fetch`; reports are files, not a database; tests use `node --test`. This keeps the install under a minute and the supply chain small.
- Reports are local JSON. Delete a report with `rm data/reports/<id>.json`, or wipe all evidence with `rm -rf data/reports`.
- Rate limit: 3 roasts per hour per IP. The YouTube collector refuses to spend more than 20 quota units in a run.
- Sessions live in one process, on `globalThis`, so dev hot reloads do not sign you out. A server restart does, by design; the token is not persisted.
- Node 24 or newer is required (the tests rely on native TypeScript stripping).

## Project layout

```
src/app          pages and API routes (auth, roast, report)
src/components   tabloid UI pieces (score gauge, roast stream, share card)
src/lib          oauth, youtube collector, signals, score, prompt, gemini, store
scripts          the Google OAuth setup wizard
tests            node --test suite
```

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the bar for new dependencies, and what makes a good roast improvement. If this made you laugh, a star helps other people find it.

## Limitations

- Watch history is unavailable through any YouTube API. The app roasts likes, subscriptions and playlists instead.
- The OAuth app stays in Testing mode, so only added test users can sign in.
- The Gemini free tier allows roughly 20 flash requests per day; the model fallback exists for that reason.
- It is a localhost app. One process, one user, no accounts, no deployment hardening.

## License

MIT. See [LICENSE](LICENSE).

RoastTube is not affiliated with YouTube or Google. It uses the YouTube Data API v3 and the Gemini API under Google's terms. Reports are satire, generated by a language model from your own activity. The roast is the product.
