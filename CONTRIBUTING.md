# Contributing

Thanks for wanting to make RoastTube meaner or more accurate. Both are appreciated.

## Ways to contribute

- Report a bug. Include your Node version, the exact error text, and the steps that produced it.
- Improve the scoring. The weights in `src/lib/score.ts` are opinions; argue with them using real data.
- Add a demo persona. Personas live in `src/lib/demo.ts` and are deterministic fixtures, no API calls needed.
- Fix docs, copy, or the tabloid CSS.
- Sharpen the roast prompts in `src/lib/prompt.ts` without breaking the honesty rules below.

## Development setup

```bash
npm install
cp .env.example .env.local   # add a free GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Demo personas work without any Google credentials. Real login is optional; the setup wizard picks it up from there.

## Before you open a pull request

Run all four and make them pass:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Two house rules:

- **No new runtime dependencies.** YouTube and Gemini are called with native `fetch`, reports are JSON files, tests use `node --test`. Open an issue first if you think a dependency earns its place.
- **New behavior needs a test.** Pure functions in `src/lib/` are covered by fixtures under `tests/`, and that is the pattern to follow.

## Roast rules (non-negotiable)

- Every joke anchors to a named channel, a real video title, or a real stat. No invented numbers.
- No appearance, health, or relationship jokes.
- No advice, no hedging, no "as an AI".
- The writing rules in the system prompt ban model-isms (em dashes, "not just X but Y", stock words like "delve" and "testament"). Keep them.

## Commit messages

One imperative line, then a short body explaining why when it is not obvious from the diff.

## Security

Do not open a public issue for a leaked secret or an auth problem. Email me@piyushmehta.com instead.
