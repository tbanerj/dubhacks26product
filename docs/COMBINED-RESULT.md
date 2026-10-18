# Combined result

**Do not merge this branch to `main`.** It needs more testing on a real device before it is safe to land. Automated tests pass. A signed-in quest, a real photo check, server XP, email confirmation, and live iMessage have not been finished.

This file is the record of the work that produced `Combined-Result`.

## Where the code came from

`Combined-Result` contains the local `combined` branch plus the extra tests and this note.

| Branch | Commit | What it is |
|---|---|---|
| `trinav` | `4f4cdcf` Refresh Thaw and verify photos with Gemini | Current app. Expo game in `thaw/`, Photon in `photon/`. |
| `combined` | `ea78810` Combine Trinav Gemini and UI with Supabase accounts | `trinav` plus the port described below. Not pushed before this branch. |
| `origin/Database-Changes` | `571ad7e` (Ryan Panda, 2026-10-17) | Accounts, schema, parties, onboarding. One commit on top of `9034bee`. The Expo app on that branch is still at the repo root. |
| `main` | `af545ac` updating proj structure | Behind both sources. |

`main` was not merged, not used as the starting point, and not used as the diff for the port. `origin/Database-Changes` was not `git merge`d. A merge would have put a second copy of the app at the repo root (`App.tsx`, `src/`) on top of `thaw/` and `photon/`. Files were copied into `thaw/` and `supabase/` instead.

History under this branch:

1. `9034bee` Build Thaw
2. `3dc551e` Add the Photon messaging service
3. `af545ac` updating proj structure (`main`)
4. `4f4cdcf` Refresh Thaw and verify photos with Gemini (`trinav`, already on GitHub)
5. `ea78810` Combine Trinav Gemini and UI with Supabase accounts

## Decisions when the branches disagreed

- Gemini quest writing and photo checks stay in the app: `thaw/src/services/gemini.ts`, model `gemini-3.5-flash-lite`, client key, local fallback. The Database-Changes edge functions `generate-quests` and `verify-evidence` were not copied and are not called.
- Accounts, Postgres, row-level security, XP, streaks, pins, global leaderboards, real parties, onboarding, and account deletion come from Database-Changes.
- Screens, theme, glass, navigation chrome, and the You / Settings / Edit avatar / Party chat layout stay from `trinav`. Intro, Auth, and Onboarding were restyled with `useTheme`.
- `.env` files stay gitignored. They hold the Gemini key and the local Supabase client values. `thaw/.env.example` lists the variable names only.

## What was ported from Database-Changes

Schema, in `supabase/migrations/`:

- `20261017220000_thaw_core.sql`. Private schema. Tables: `profiles`, `player_stats`, `completions` (unique user + quest), `visited_landmarks`, `collectibles`, `daily_xp`. Clients can select their own rows. The only direct client write is `profiles.display_name` and `profiles.avatar_hue`. A new auth user gets a profile and stats from a trigger. `complete_quest` awards XP on the server: easy 60, medium 90, hard 130, party bonus 10 per extra member capped at 30 and never for solo, plus 20 for the first visit to a landmark. It is idempotent. Completions must be at least 20 seconds apart, with a cap of 40 per day. Timezone is an IANA name or UTC. `get_leaderboard` and `get_my_rank` return rank, display name, avatar hue, and score. Kinds: daily, allTime, quests, landmarks. Daily is today or yesterday only. Limit is 1–100. The `anon` role has no access.
- `20261017233000_parties_onboarding.sql`. `profiles.onboarded_at`. Parties use a 6-character code from `A–Z` and `2–9` (no I, O, 0, 1) and expire after 12 hours. Party members cap at 4 and have a ready flag. Messages are 1–280 characters. `ai_usage` is service-role only. Realtime is enabled. RPCs: create, join, leave, set ready, set quest (host), send message, get party state. Create-party is limited to 10 per hour. Chat is 5 messages per 10 seconds. Party size for XP comes from real membership. This migration revokes `authenticated` execute on `complete_quest`, so only `verify-evidence` could award XP on that branch.
- `20261018000000_client_complete_quest.sql`. Written for this merge. Grants execute on `private.complete_quest_impl(...)` and `public.complete_quest(...)` back to `authenticated`, because the app checks the photo with Gemini and then records the reward with the RPC. Without this grant, a signed-in quest save fails with Postgres `42501`. **This file is in the repo. It has not been applied to the live Supabase project.**

Edge function kept: `supabase/functions/delete-account/index.ts` only.

App code added under `thaw/`:

- `src/services/supabase/client.ts`. PKCE, AsyncStorage, null when Supabase env is missing. Imports `react-native-url-polyfill/auto`.
- `src/services/supabase/database.types.ts`. Generated types, with `complete_quest` restored on `Functions`.
- `src/services/auth.ts`. Email and password, display-name checks, friendly errors.
- `src/services/cloud.ts`. `submitCompletion`, server reward parsing, error mapping for duplicate, rate limit, daily limit, invalid input, network, and auth.
- `src/services/supabaseParty.ts`. Invite codes and Realtime when the player is signed in and not in demo mode.
- `src/hooks/useAuthBootstrap.ts`, `src/navigation/navigationRef.ts`.
- `src/screens/AuthScreen.tsx`, `IntroScreen.tsx`, `OnboardingScreen.tsx`.

Dependencies added in `thaw/`: `@supabase/supabase-js@2.118.0`, `expo-linking@~57.0.13`, `react-native-url-polyfill@^4.0.0`. `thaw/app.json` scheme is `thaw`.

## What stayed from trinav

- In-app Gemini client for writing quests and checking photos.
- Existing tab and stack UI: Explore, Party, Collection, You, Leaderboard, Settings, Edit avatar, Party chat, quests.
- Theme, glass, and navigation chrome.
- Photon remains a separate Bun service in `photon/`. The app only POSTs to `EXPO_PUBLIC_PHOTON_RELAY_URL` when that URL is set. Photon was not rewritten in this merge.

`thaw/src/store/useGameStore.ts` was rewritten so both sides fit:

- Account, onboarding, sync state, and a separate demo score stash.
- `setDemoMode`, `startWorld`, `recordLiveReward`, `pullCloud`, `initAuth`, `signOut`, `deleteAccount`, `resetDemo`.
- Demo mode uses the simulated party. A signed-in player who is not in demo mode uses `SupabasePartyService`.
- `completeActiveQuest` returns `{ ok: false, reason: 'not-demo' }` unless demo mode is on.
- Real mode position comes from GPS only. The region picker and long-press walk are demo-only.
- New accounts start at 0. Guest or demo XP is not uploaded. `appearance` stays on the device.
- Persist key is `thaw-game-v3` so an old v1 cache does not load.
- Default is demo mode off, GPS location, empty progress.

Reward path on the verify screen:

- Demo mode uses local `applyCompletion`.
- Signed-in live mode requires `verification.source === 'gemini'`, then `recordLiveReward` → `submitCompletion` → `rpc('complete_quest')` → `pullCloud()`.
- A simulated Gemini fallback does not grant server XP.
- Solo quests force party size 1, so a stale party size cannot add a party bonus.

Navigation gate in `RootNavigator`:

- Missing Supabase env → “Thaw isn’t connected”.
- Auth not ready → splash.
- Signed out → Intro, then Auth.
- Signed in and onboarding unknown → splash.
- Onboarding needed → Onboarding.
- Otherwise the existing tabs and stack, including Auth.

Other screen behavior:

- Explore blocks real play until GPS is available (`needs-location`).
- Active quest refreshes GPS before check-in when not in demo mode.
- Settings shows email, Supabase and Gemini status, sign out, delete account, and the demo-mode switch.
- Profile shows a sync chip.
- Party can join by code when not in demo mode.
- Leaderboard fetches the global board when signed in and not in demo mode.
- Overpass tries the configured URL, then `overpass.kumi.systems` and `overpass.private.coffee`.

Auth rules in the app: password 8–72 characters with letters and numbers; display name 1–24 characters and no control characters. Confirm-email is expected to be on in the Supabase project. Redirects are `thaw://` and Expo `exp://`. Add both to the Supabase redirect allow list.

`over_email_send_rate_limit` and `over_request_rate_limit` are shown as “Too many attempts. Please wait a minute and try again.”

## What was checked

On 2026-10-17, after the extra tests in this commit:

- `cd thaw && npm test`: 7 suites, 76 tests, all passed. Includes `accounts.test.ts`, `progression.test.ts` (solo quests ignore a passed-in party size), and `edge.test.ts` (real mode refuses sample regions, simulated walks, and local rewards; demo mode stashes a real score of 500 and restores it).
- `cd photon && bun test`: 24 tests, all passed.
- Supabase host `https://rxtllandrfntemhiyzun.supabase.co` answered. `/auth/v1/health` without an API key returned HTTP 401 “No API key found in request”, which means Auth is up. With the publishable key, anon `GET /rest/v1/profiles` and anon `POST /rest/v1/rpc/complete_quest` returned 401 / `42501`. Anon is supposed to be denied. That check does not show whether `authenticated` can execute `complete_quest`.
- A Gemini `generateContent` call with the local key returned HTTP 200 and text.
- Expo web was already serving this app on port 8081. A second `npx expo start --web --port 8081` failed because that port was taken. Metro was later restarted with `npx expo start`. iOS bundled (`1437` modules). Three warnings: `WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256.` That is PKCE on Expo Go. It is not the signup failure. It can still break the email-confirmation deep link later.
- One Metro crash, `Unable to resolve module react-native-url-polyfill/auto`, plus `Cannot read properties of undefined (reading 'subscribe')`, happened before `react-native-url-polyfill` was installed. `npm install` in `thaw/` and an Expo restart cleared it.
- Photon demo API was smoked locally: `/health` and `/ready` are public; other routes need header `x-thaw-dev-user` matching `^[A-Za-z0-9_-]{1,64}$` or they return 401. Unknown paths are 401 without a user and 404 with one. Link tokens start as `issued`. `pending` is true only after the text chat sends `LINK`. Confirm before that returns “There is no pending Messages connection...”. `THAW_VERIFIER=live` refuses to start. Default port is 3001. `bun start` waits on stdin because the demo CLI is interactive.

Dashboard for the same hour as the signup attempts: 57 requests, about 50.9% success. Auth was 12 requests and 12 warnings, 0 errors. Those warnings are the rate-limit responses. Postgres had 3 errors, consistent with the permission denials above. Storage was clean.

## What is not done

Do not merge to `main` until these are done:

1. Apply `supabase/migrations/20261018000000_client_complete_quest.sql` on the live project. Until then, a signed-in Gemini accept cannot write XP.
2. Sign up once as a new user, open the confirmation email, sign in, and confirm the app reaches onboarding and then the map. On 2026-10-17, repeated Create account taps (including a real Gmail address) were rejected with “Too many attempts.” Auth logged only warnings. Whether that Gmail account exists is unknown. The password tried in the browser was a test password chosen during the session, not a known account password.
3. Walk one real quest with GPS: check in, take a photo, get a Gemini accept, and see server XP, a pin, and the global leaderboard change. This path was not completed.
4. Raise **Authentication → Rate Limits** for sign-ups, sign-ins, and emails, and add custom SMTP under **Authentication → Emails**. Leave **Allow new users to sign up** on. The built-in mailer only delivers to Supabase org members and only a couple of emails per hour, so public Gmail signups stay blocked after the rate-limit window as well. The app does not implement its own signup cap.
5. Exercise a real party: create, join by code from a second account, ready, host sets the quest, chat, and confirm the party bonus uses real membership.
6. Delete-account against the deployed `delete-account` function, not only the copied source.
7. Photon live iMessage. That needs `PROJECT_ID` and `PROJECT_SECRET` and a phone. It was not started. `photon/.env` must stay uncommitted.
8. Confirm the Expo Go PKCE warning does not block the confirmation link. If it does, test the link on a build that has WebCrypto, or sign in with the password after the email is confirmed on Supabase’s side.

## How to run this branch

```bash
cd thaw
npm install
npx expo start
```

Copy `thaw/.env.example` to `thaw/.env`. Set the Gemini key and the Supabase URL and publishable key. Never put the service-role key in the app.

```bash
cd photon
bun test
# demo CLI, interactive:
bun run messaging:demo
```
