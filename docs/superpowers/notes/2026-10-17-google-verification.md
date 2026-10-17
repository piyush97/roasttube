# Google OAuth verification prep — RoastTube

Status as of 2026-10-17: code side is built, merged, and deployed (commits `06d9c8f`, `36f4ae3`;
Worker version `ad851edb-f09e-4502-8777-e1d00e2543ac`). The verification submission is blocked on
the console steps below plus a demo video recorded against the live production flow.

Live URLs (all return 200):

- App: https://roasttube.piyushmehta.com
- Privacy policy: https://roasttube.piyushmehta.com/privacy
- Terms: https://roasttube.piyushmehta.com/terms
- Consent-screen logo: https://roasttube.piyushmehta.com/consent-logo.png (source:
  `public/consent-logo.svg`)

## 1. Console walkthrough (Google Cloud Console → "Google Auth Platform")

### Branding

- App name: `RoastTube`
- User support email: `me@piyushmehta.com`
- App logo: upload `/home/piyush/Projects/roasttube/public/consent-logo.png` (120×120 PNG)
- Application home page: `https://roasttube.piyushmehta.com`
- Privacy policy link: `https://roasttube.piyushmehta.com/privacy`
- Terms of service link: `https://roasttube.piyushmehta.com/terms`
- Authorized domains: `piyushmehta.com`
- Developer contact information: `me@piyushmehta.com`

### Audience

- Click **Publish app** (move from Testing to Production). The unverified-app warning still shows
  to users; that is expected and is exactly what verification removes. Publishing lifts the
  100-test-user cap.

### Data access (scopes)

- Confirm the only scope listed is `https://www.googleapis.com/auth/youtube.readonly`.
- Delete any extra scope (e.g. email/profile) — the app requests none of them, and every extra
  scope widens the review.

### Clients (Credentials page)

- Open the RoastTube web client → **Authorized redirect URIs** → add:
  `https://roasttube.piyushmehta.com/api/auth/callback/google`
- Keep the existing `http://localhost:3000/...` URI (local dev still needs it).
- Save. Propagation can take a few minutes.

### Search Console

- https://search.google.com/search-console → confirm the `piyushmehta.com` property is
  **Verified** for your Google account. Two `google-site-verification` TXT records already exist
  on the domain; if it is not verified, click Verify. If it asks for a new TXT value, ping the
  agent to add it via the `cf` CLI.

## 2. Demo video (record after the prod E2E passes)

Google wants a short, unedited walkthrough of the real flow. Checklist:

- Use a Google account that has **not** granted RoastTube access yet, so the consent screen
  actually appears on camera. Revoke first at https://myaccount.google.com/permissions, or use a
  second account.
- Keep the browser URL bar visible for the whole recording.
- Show: https://roasttube.piyushmehta.com → click "Roast my YouTube" → Google account picker →
  consent screen (this is the screen reviewers look for) → back on the app, the roast runs →
  report page with the score.
- 1–2 minutes, no cuts, upload as unlisted YouTube video, English audio or on-screen text.

## 3. Scope justification (paste into the verification form)

> RoastTube is a free, single-purpose entertainment site at https://roasttube.piyushmehta.com. A
> visitor signs in with Google, and RoastTube reads their liked videos, subscriptions, and
> playlist titles via the YouTube Data API (youtube.readonly) to generate a one-time comedy roast
> of their taste. We request only youtube.readonly — no email, profile, or other Google scopes —
> and an online-only token that expires within the hour: we never store access tokens on our
> servers, never request refresh tokens, and never use the data for ads, analytics, or profiling.
> The data is fetched once per roast, used to compute a score and prompts sent to Google's own
> Gemini model to write the roast text, and the finished roast (including the video and channel
> titles it was built from) is stored under a random id so the user's shareable report link keeps
> working. Users can have a stored roast deleted by emailing us and can revoke access at any time
> via their Google account permissions (https://myaccount.google.com/permissions). There is no
> alternative API for this feature: comparing a user's subscription choices against their own
> liked videos and playlist titles requires read access to the user's own YouTube account data.
> Full details: https://roasttube.piyushmehta.com/privacy

## 4. Still pending from Task 11 (prod E2E)

1. Local DNS flush so this machine resolves the new domain:
   `sudo resolvectl flush-caches` (fallback: `chrome://net-internals/#dns` → Clear host cache).
2. The authorized redirect URI above (console → Credentials).
3. Then the agent runs the prod E2E in the browser: home → demo roast (cache) → Google sign-in
   round-trip → auto-run roast → report → sign-out → rate-limit message.
