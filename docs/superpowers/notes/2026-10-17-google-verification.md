# Google OAuth verification prep — RoastTube

Status as of 2026-10-17: code side is built, merged, and deployed (commits `06d9c8f`, `36f4ae3`;
Worker version `ad851edb-f09e-4502-8777-e1d00e2543ac`). The production E2E passes end to end.
The verification submission is now blocked only on: Branding App name fix, Publish to Production
(if not yet), the demo video, and the submission form itself.

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

## 4. Prod E2E — passed 2026-10-17

Recorded run on the custom domain (browser session via bsk):

1. Home loads at https://roasttube.piyushmehta.com with the new Privacy/Terms footer links.
2. Demo click 1 (The Lurker) → `/report/5uej7f57` served from the demo cache.
3. Demo click 2 → same report id; cache confirmed.
4. Google sign-in round-trip → callback → `/?run=1` → auto-run YouTube roast → `/report/6mv1evge`
   ("Your Watch History Is A LinkedIn Post That Never Ends", score 20) — a real generation from
   real account data. No consent screen appeared for the test account (consent was granted
   previously); a fresh account will see it, which is what the demo video needs.
5. Sign-out returns the home page to the signed-out state.
6. Fourth click → `3 roasts per hour. Breathe. Try again later.` — rate limit verified in prod.

### Bug found and fixed during the E2E

The first sign-in attempt failed with `Error 401: invalid_client — The OAuth client was not
found` because the client id sent to Google was wrapped in literal single quotes. `.dev.vars`
held double-wrapped values from an older wizard run, and the wizard's reader stripped only one
layer before uploading Worker secrets. Fixed in `scripts/setup-cloudflare.sh`: a new
`_strip_quotes` helper strips any number of quote layers and now runs in `_read_dotenv`, `ask`,
`ask_secret`, and `_cf_secret`. The corrected `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` were
re-uploaded to the Worker.

### Also seen during the E2E

- The Google account chooser shows the app as **"piyushmehta.com"** — the Branding App name has
  not been set yet. Set it to `RoastTube` before recording the video (reviewers see this name).
- The signed-in test account (write2pmehta@gmail.com) did not see the unverified-app warning
  because it had already granted consent; new users will see it until Google approves the app.

### Remaining before submission

1. Branding → set App name `RoastTube` and upload the current logo (`public/consent-logo.png`,
   now the character mark). If the older wordmark was uploaded before, replace it.
2. Publish app to Production in Audience (if not already done).
3. Demo video (section 2) — use an account that has never granted RoastTube access.
4. Submit in the Verification Center with the justification in section 3.
