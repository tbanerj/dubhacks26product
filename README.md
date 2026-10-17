# Thaw

**The world gets warmer when you show up.**

Thaw is a real-world social adventure game. The map of wherever you are becomes a game board: public parks, libraries, squares, markets and public art turn into quest hubs. Accept a quest, walk there, check in, snap photo evidence, and earn XP plus an illustrated souvenir pin. Some quests are better with a party of 2–4, and every social quest has a solo option, so nobody has to approach a stranger.

Accounts, cloud saves and global leaderboards run on **Supabase** (Postgres + Auth + an Edge Function).

Built with React Native + Expo SDK 57 (expo 57.0.9, React Native 0.86, Expo Go), TypeScript (strict), React Navigation, Zustand, react-native-maps, expo-location, expo-image-picker, zod and react-native-svg.

---

## Run it (no keys needed)

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (SDK 57). Everything works without API keys, accounts, or a backend.

You can also review the UI in a browser with `npx expo start --web`. react-native-maps has no web support, so the browser shows an illustrated board projection of the same quest hubs (`GameMap.web.tsx`).

> Expo pinned at exactly 57.0.9 by request; `npx expo install --check` notes that 57.0.30 is the latest SDK 57 patch. Expo CLI may also warn that Node ≥ 22.13 is preferred.

### The 2-minute judge path

1. **Launch.** The welcome card explains the idea. Tap **Explore a sample city** (or **Use my location**).
2. **Map.** Hubs show state at a glance: ✦ new, 👥 co-op, 🏁 in progress, ✓ explored. The **Nearby quests** tray is the accessible alternative to tapping pins.
3. **Quest detail.** Shows steps, distance, duration, XP, the collectible preview, safety notes and the solo option. Tap **Accept quest**.
4. **Active quest.** Tap **Check in** (too far away → you're told the distance). In demo mode, **Simulate walking there**, then check in.
5. **Evidence.** **Take photo** or **Choose photo**, preview it, retake if you like, then **Submit**. To rehearse the failure path, set *Demo: next simulated result* to **Reject**, then **Try again**.
6. **Reward.** You get confetti, an XP count-up, a level-up when you earn one, the pin unlock, and your rank on today's board.
7. **Pins / Ranks / You.** All three reflect the completion immediately. The **Party** tab lets you start a party, invite demo explorers, toggle ready, and chat.
8. **You → Reset demo** returns everything to first launch, for repeatable judging.

---

## Teammate guide: keys, testing, and shipping

This section is the hand-off. Work through it top to bottom.

### 1. One-time setup

1. Install **Node.js 22.13 or newer** (`node -v` to check).
2. Clone the repo and run `npm install`. Use npm, not bun or yarn: `package-lock.json` is the source of truth.
3. Install **Expo Go** on your phone. It must be a version that supports **SDK 57**. If the App/Play Store version only supports a newer SDK, use a development build (see step 5 of "Production readiness") or an Android emulator / iOS simulator with a matching Expo Go.
4. Run `npx expo start`. Scan the QR code (iOS: Camera app; Android: Expo Go). If your phone and laptop aren't on the same network, as is common on hackathon Wi-Fi, use `npx expo start --tunnel`.

### 2. API keys

Every key is **optional**: the app is fully playable without any of them. Add them one at a time and confirm each in **You → Integrations**, where it flips from *Demo* to *Live*.

```bash
cp .env.example .env      # then edit .env
npx expo start -c         # -c clears the cache; required after ANY .env change
```

`.env` is gitignored. **Never commit it, and never paste keys into Discord or Devpost.**

| Key in `.env` | Where to get it | What changes when set | How to confirm it works |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Already filled in `.env.example`** for our project (`rxtllandrfntemhiyzun`). The publishable key is designed to ship in apps, because Row Level Security protects the data. Never use the `secret`/`service_role` key in the app | Accounts, verified email, cloud saves, global leaderboards | **You → Integrations** shows *Supabase … Live*, and the welcome card shows "I have an account – sign in" |
| `EXPO_PUBLIC_GEMINI_API_KEY` | [Google AI Studio → Get API key](https://aistudio.google.com/apikey) (free tier is enough) | Quests near you are written by Gemini (`EXPO_PUBLIC_GEMINI_MODEL`, default `gemini-2.5-flash`) | Tap **↻ Refresh quests** on the map. Cards show an **AI** chip, and quest detail says "Quest written by Gemini". If the call fails, a yellow note on the map says why, and built-in quests are used. |
| `EXPO_PUBLIC_PERCEPTRON_API_KEY` | From the Perceptron team (DubHacks workshop) or their developer dashboard | Photo evidence is really analysed. Base URL `https://api.perceptron.inc/v1` and model `perceptron-mk1.5` are overridable | The verify screen's note changes from "Demo mode: verification is simulated" to "sent to Perceptron". Submit a matching photo (should pass) and an unrelated one (should fail with the model's observations). |
| `EXPO_PUBLIC_PHOTON_RELAY_URL` | URL of **our own** relay server (not built yet; see "Photon" below). The Photon key lives on that server, never in the app | **Share invite** also POSTs `{ "message": "..." }` to `<relay>/invites` | The party screen shows "Invite also sent through your Photon relay", or the relay's error. |
| `EXPO_PUBLIC_OVERPASS_URL` | Leave the default unless rate-limited; alternatives are listed at wiki.openstreetmap.org/wiki/Overpass_API | Source of real nearby places when using **Use my location** | Use my location → hubs have real local names and show "· OSM" in the hub card. |

> ⚠️ Anything prefixed `EXPO_PUBLIC_` is compiled into the app and can be extracted by anyone who has the build. Use throwaway or demo keys with spending caps for the hackathon, and rotate them afterwards.


### 2b. Supabase dashboard settings (one-time, project owner)

These live in the Supabase dashboard ([project](https://supabase.com/dashboard/project/rxtllandrfntemhiyzun)). They can't be set from code.

1. **Authentication → Sign In / Providers → Email:**
   - **Confirm email: ON.** This is what makes players prove their email. It's normally on by default; double-check it.
   - **Minimum password length: 8**, and require letters + digits, to match the app's own check.
   - (Pro plan) turn on **leaked password protection**.
2. **Authentication → URL Configuration:**
   - **Site URL:** `thaw://`
   - **Redirect URLs:** add `thaw://**`, `exp://**` and `http://localhost:8081/**`. Expo Go uses `exp://` links, real builds use `thaw://`, and the web preview uses localhost. Without these, links in emails can't open the app. The email still gets verified either way, and the player just signs in manually.
3. **Authentication → Emails → SMTP Settings: set up custom SMTP before anyone outside the team signs up.** ⚠️ Supabase's built-in email sender **only delivers to members of the Supabase organization** (anyone else gets "Email address not authorized") and is heavily rate-limited. Any provider works; Resend, Postmark, Brevo and Amazon SES all have free tiers. Until then, add teammates/judges to the org (**Organization → Team**) so their verification emails arrive.
4. **Authentication → Rate Limits:** review the email and sign-up limits once custom SMTP is on.

Nothing else is needed: the database schema, security policies and the `delete-account` Edge Function are already deployed. Their source is in `supabase/`.

### 3. Test checklist (on a real phone)

Do this once with **no keys** and once **with keys**. Mark each line pass or fail. Before each run, use **You → Reset demo** for a clean slate.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | Fresh launch, no keys | Delete Expo Go app data (or Reset demo), open the app | Welcome card; map with hubs; "Demo mode" badge; no crash |
| 2 | Location granted | Welcome → **Use my location** → Allow | Avatar at your real position labelled "You"; real nearby places from OSM (or a yellow note explaining the fallback) |
| 3 | Location denied | Reset demo → Use my location → **Don't allow** | Friendly message; game still playable in a sample city |
| 4 | Location services off | Turn off phone location → Use my location | "Location services are turned off" message, no hang |
| 5 | Switch region | Tap the location chip → pick Tokyo, Nairobi, São Paulo… | Map flies to new places; quests regenerate |
| 6 | "Anywhere" mode | Region picker → **Anywhere** | Five "Sample …" spots around you, clearly labelled as samples |
| 7 | Long-press | Long-press the map → Explore here | Places load around that point |
| 8 | Discover + accept solo quest | Tap a pin (and separately, a card in the tray) → **Accept quest** | Active quest screen with steps |
| 9 | Check-in gate | **Check in here** while far away | "You're X away. Get within 120 m" |
| 10 | Real walk (with GPS) | Walk to a quest hub → Check in | Check-in succeeds within ~120 m |
| 11 | Simulated walk | **Simulate walking there (demo)** → Check in | Succeeds; avatar label shows "You (sim)" |
| 12 | Camera evidence | **Take photo** → allow camera → shoot | Polaroid preview; Retake works |
| 13 | Library evidence | **Choose photo** | Preview shows the picked image |
| 14 | Permission denied | Deny camera | Clear message pointing to the library option |
| 15 | Verification failure + retry | Demo selector → **Reject** → Submit → switch to **Accept** → **Try again** | "Not quite!" card, then reward screen |
| 16 | Rewards | Complete a quest | Confetti, XP count-up, level-up if crossing 100/300/600 XP, new pin |
| 17 | XP exactly once | After the reward, go back and try to re-accept the same quest | Shows **Completed**; XP unchanged |
| 18 | Collection + leaderboard | Open **Pins**, then **Ranks** (all four tabs) | New pin unlocked; your XP and rank updated |
| 19 | Party | **Party** → Start a party → invite 3 demo explorers → toggle ready → chat → Leave | Max 4 members; demo labels visible; replies arrive; leaving clears it |
| 20 | Party quest gating | Without a party, open a **Party** quest | "Needs a party of 2–4" plus **Find a party** / **Play the solo version** |
| 21 | Persistence | Complete a quest → force-quit → reopen | XP, pins, streak and active quest all retained |
| 22 | Reset | You → Reset demo | Back to 140 XP, level 2, welcome card |
| 23 | Offline | Airplane mode → Use my location / Refresh | Fallback places/quests with an explanatory note; nothing dead-ends |
| 24 | Settings | Toggle imperial units, prefer solo, low-mobility | Distances switch to ft/mi; social/party quests disappear; hard quests disappear |
| 25 | Gemini live | With key: Refresh quests in two different cities | AI chips; quests specific to each place; nothing unsafe |
| 26 | Perceptron live | With key: submit a matching and a non-matching photo | Pass and fail respectively, with observations |
| 27 | Accessibility | Turn on VoiceOver/TalkBack and the largest text size | Pins, cards and buttons are announced; text scales without overlapping |
| 28 | Both platforms | Repeat 1, 8, 12, 16 on iOS **and** Android | Custom markers render; Android map uses the warm paper style |
| 29 | Sign up | You → **Create account** with a team-member email (see 2b.3) | "Check your inbox" screen; email arrives |
| 30 | Verify email | Tap the link in the email on the phone | App opens and you're signed in. If it opens on a laptop instead, go back and tap **I've verified – sign in** |
| 31 | Unverified sign-in | Sign in before verifying | "Please verify your email first", then the Check-inbox screen with **Resend** |
| 32 | Wrong password | Sign in with a wrong password | "Email or password is incorrect." |
| 33 | Cloud save | Signed in: complete a quest → You tab | Chip shows **Synced**; the Ranks tab shows the **Global** board with you on it |
| 34 | Second device | Sign in on another phone (or web) | Same XP, pins, streak, history, name and avatar colour |
| 35 | Offline sync | Airplane mode → complete a quest → turn network back on → reopen the app | "1 quest waiting to sync", then **Synced**; XP counted once |
| 36 | Duplicate protection | Complete the same quest on two devices | Second device gets no extra XP (server says duplicate) |
| 37 | Rate limit | Complete two quests within 20 seconds | Second one queues and syncs on its own ~20 s later |
| 38 | Rename | Change name/colour on You tab | Global leaderboard shows the new name/colour |
| 39 | Forgot password | Sign in → **Forgot password?** → open link on the phone | "Choose a new password" screen → saving signs you in |
| 40 | Sign out | You → **Sign out** | Guest progress from before sign-in comes back; Ranks shows the local demo board |
| 41 | Delete account | You → **Delete account** → confirm | Signed out; signing in again fails; the player is gone from the global board |

Also run `npm run typecheck && npm run lint && npm test` before every push.

If something fails, note the step number, the platform, and a screenshot. JS errors appear in the terminal running `expo start`.

### 4. Production readiness

**Today the app is a hackathon demo, not a production app.** These are the remaining items, in priority order. Item 2 (accounts + server-side state) is done; the rest are open.

**Must-have before any public release**

1. **Backend proxy for AI keys.** Add a small server (Vercel/Cloudflare Functions, Supabase Edge Functions, etc.) with `POST /quests` → Gemini and `POST /verify` → Perceptron. Move the keys there, add per-user rate limiting, then change the URLs in `src/services/gemini.ts` and `src/services/perceptron.ts`. Remove `EXPO_PUBLIC_GEMINI_API_KEY` and `EXPO_PUBLIC_PERCEPTRON_API_KEY` from the app entirely.
2. ✅ **Accounts + server-side game state — done.** Supabase Auth with verified email, server-authoritative XP, streaks, pins and leaderboards, RLS on every table, account deletion. See "Database" below. **Still open on this front:**
   - **Custom SMTP** (see 2b.3). Without it, only team members can verify their email.
   - **Photo verification still isn't enforced by the server.** `complete_quest` trusts that the client verified the photo. To close that hole, move the Perceptron call into an Edge Function that verifies the photo and *then* calls `complete_quest` with the service key, and revoke `complete_quest` from `authenticated`.
   - **Quest legitimacy.** Quests are generated on the device, so a modified client could invent quest IDs. Server XP is bounded (≤180 per quest, 1 per 20 s, 40 per day), so the damage is capped, but the real fix is generating and storing quests server-side (item 14) and having `complete_quest` only accept known quest IDs, ideally with a server-side distance check against the player's reported location.
   - **Guest → account merge.** Guest progress isn't uploaded on sign-up (it can't be trusted), so new accounts start at 0 XP.
3. **Real multiplayer.** Implement `PartyService` (`src/services/photon.ts`) over a realtime backend (Supabase Realtime, Firebase, Ably, or our own WebSockets). Keep the privacy rule that only coarse proximity buckets ever reach other clients. Use the Photon agent for SMS/iMessage invites through the relay.
4. **Trust & safety.** Add report and block for players and chat messages, chat moderation (a server-side text filter or model), an age gate (13+ or local equivalent), a Terms of Service, a privacy policy (location + camera + photo processing), and an account/data deletion flow. These are app store requirements.
5. **Builds.** Move from Expo Go to **EAS Build** (`npm i -g eas-cli && eas build:configure`). Set the bundle IDs in `app.json`. For Android, add a Google Maps API key under `android.config.googleMaps.apiKey`, because Google Maps needs it outside Expo Go. Upgrade Expo to the latest SDK 57 patch (`npx expo install expo@~57.0.30 && npx expo install --fix`; currently pinned at 57.0.9 on purpose).
6. **Places at scale.** Self-host Overpass or switch to a commercial places API, since the public Overpass endpoint is not meant for production traffic. Keep the OSM attribution.

**Should-have**

7. Crash and error reporting (Sentry via `@sentry/react-native`), plus privacy-respecting analytics on the core funnel (open → accept → check-in → complete).
8. CI: GitHub Actions running typecheck, lint and tests on every PR, plus an EAS preview build.
9. Translations for the strings in `src/i18n/strings.ts`, and a language passed to the Gemini prompt (currently English-only).
10. A full accessibility audit (contrast, screen-reader order, reduced-motion support for the confetti and reward animations).
11. Store assets: icon, splash, screenshots, and a store listing. Replace the template icons in `assets/`.
12. OTA updates with `expo-updates`, and staged rollouts.

**Nice-to-have**

13. Replace demo leaderboard rivals with real friends or region boards. Add weekly seasons.
14. Server-generated, cached quests per place, so every player at the same spot sees the same quests, AI costs stay bounded, and `complete_quest` can validate quest IDs.
16. Leaderboard scale: today ranks are computed on request. That's fine for thousands of players. Past that, cache them (a materialized view refreshed by `pg_cron`, or a Redis sorted set) and use Supabase **Realtime** for live rank changes.
17. Database ops: upgrade to a paid plan for **daily backups + point-in-time recovery**. Use **Supabase branching** or a staging project for schema changes. Write future migrations with the Supabase CLI (`supabase migration new`) so they're tracked in `supabase_migrations`. The current one was applied over the MCP connector, and its exact SQL is in `supabase/migrations/`.
15. Push notifications for party invites and streak reminders, opt-in only.

---

## What's real vs simulated

| Area | Without keys (demo) | With configuration |
|---|---|---|
| Places | Saved demo places for 6 cities on 5 continents, plus "Anywhere" sample spots (labelled as samples) | **Use my location** queries **OpenStreetMap (Overpass API)** live: no key, cached 24 h, rate-limited, attributed |
| Quests | Original local templates keyed to the *kind* of place (garden ≠ library ≠ market), time-of-day aware, deterministic IDs | **Gemini** (`generateContent`, JSON schema mode). Every AI quest is zod-validated and safety-filtered, and anything rejected is replaced by a local quest |
| Photo verification | **Transparent mock.** The UI says it's simulated, and the photo never leaves the device | **Perceptron** chat-completions API (`POST /v1/chat/completions`, image as a data URI), with timeout, one retry and a parsed verdict |
| Party / presence | Deterministic local lobby. Demo participants are always labelled "demo". Membership, ready states and chat work | See "Photon" below |
| Accounts | Guest mode: progress on this device only | **Supabase Auth**: email + password, email verification, password reset, sign out, delete account |
| Leaderboards | Local: your real progress vs labelled demo profiles, labelled "Local demo" | **Global** boards from Supabase (today / all-time / quests / places), computed on the server |

The app never presents simulated data as real. Demo participants are marked as demo, verification says "Simulated", the position chip shows **Sample location** / **Simulated position** / **Your location**, and map attribution notes demo places.

## Configuration

Copy `.env.example` to `.env` and fill in only what you have:

```
EXPO_PUBLIC_GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE        # = GEMINI_API_KEY
EXPO_PUBLIC_PERCEPTRON_API_KEY=YOUR_PERCEPTRON_API_KEY_HERE  # = PERCEPTRON_API_KEY
EXPO_PUBLIC_PHOTON_RELAY_URL=                               # your backend, see below
```

Placeholders (`YOUR_…_HERE`) are treated as "not configured". All env access lives in `src/config/env.ts`. **You → Integrations** shows which services are live.

**Security note:** Expo inlines `EXPO_PUBLIC_*` values into the JS bundle, so anyone can extract them from a shipped app. That's acceptable for a local hackathon demo build only. For production:
- **Gemini** and **Perceptron** need a small backend proxy that holds the keys. The service modules isolate the `fetch` call, so you only change the URL.
- **OpenStreetMap Overpass** is a public, keyless API and is safe to call from the client. For scale, self-host it or use a commercial geocoder, per the OSM usage policy.

### Photon (read this)

The DubHacks '26 sponsor **Photon 2.0** (photon.co) is a platform for *messaging agents* on iMessage, SMS, RCS, WhatsApp, Telegram, email and voice. It is not a client-side realtime multiplayer SDK, and its keys belong on a server. So `src/services/photon.ts`:

- defines a transport-agnostic `PartyService` interface that the store and screens depend on;
- ships `SimulatedPartyService` (the local lobby);
- has **Share invite**, which uses the OS share sheet (real and works today). If `EXPO_PUBLIC_PHOTON_RELAY_URL` is set, it also POSTs `{ message }` to `${relay}/invites`. That endpoint is **our own contract** for a backend you'd build where a Photon agent texts the invite. No Photon SDK methods are called or invented in the app.

Per the hacker guide, the Photon track requires a project "built on Photon 2.0 and live on at least one Photon channel". The app alone does not meet that. It needs the relay agent.

---

## Database (Supabase)

Project `rxtllandrfntemhiyzun` (Postgres 17, us-east-1). The schema is in [`supabase/migrations/20261017220000_thaw_core.sql`](supabase/migrations/20261017220000_thaw_core.sql), and the Edge Function in [`supabase/functions/delete-account`](supabase/functions/delete-account/index.ts). Generated types are in `src/services/supabase/database.types.ts`.

| Table | What | Client access |
|---|---|---|
| `profiles` | display name, avatar colour | read own; update own `display_name`/`avatar_hue` only (column-level grant) |
| `player_stats` | total XP, quests, places, streak | read own |
| `completions` | one row per rewarded quest, `unique(user_id, quest_id)` | read own |
| `collectibles` | pins | read own |
| `daily_xp` | XP per player per *local* day | read own |
| `visited_landmarks` | first visits (for the first-visit bonus) | read own |

**Security model.** RLS is on for every table. Clients can never INSERT/UPDATE/DELETE game data. The only write path is `rpc('complete_quest')`, which runs on the server and:
- computes XP (easy 60 / medium 90 / hard 130, + party bonus ≤30 but never for solo quests, + 20 for a first visit). It ignores any XP number the client might send;
- is **idempotent** per (player, quest): retries and duplicates return `duplicate: true` and grant nothing;
- **rate-limits** (1 completion per 20 s, 40 per local day) and validates every input;
- computes streaks and daily XP in the player's IANA time zone (bad zones fall back to UTC);
- locks the player's stats row so concurrent submits can't double-count.

`get_leaderboard(kind, day, limit≤100)` and `get_my_rank` return **only** display name, avatar colour and score: no user IDs, no emails. Privileged code lives in an unexposed `private` schema behind `SECURITY INVOKER` wrappers. `anon` has no access to anything. New users get a profile + stats row from an `auth.users` trigger. Deleting the auth user cascades to all game data.

**How it was verified (on the live project).**
- An SQL test transaction (rolled back) checked profile bootstrap, name sanitising, XP maths, the solo party-bonus rule, duplicates, the rate limit, input and null validation, denied direct writes, denied protected columns, cross-user isolation, leaderboard/rank output, day-window validation, and `anon` denial.
- An end-to-end run over the real HTTP API with supabase-js covered sign-in (and a wrong password), RPCs, forged writes (HTTP 42501), rename, global and daily boards, and account deletion through the Edge Function (sign-in fails afterwards, all rows cascade-deleted).
- Supabase **security advisor: 0 findings.** The performance advisor only flags two leaderboard indexes as unused, which is expected with no data yet.

**App sync.** Completions show their reward instantly, then go into a persisted queue that `flushPending()` submits. It retries on network errors and rate limits, and drops (with a note) on the daily cap or invalid input. Afterwards `pullCloud()` replaces local progress with the server's numbers, so the server always wins. Guest progress is set aside on sign-in and restored on sign-out.

## Architecture

```
App.tsx                      fonts, hydration gate, error boundary, navigation
src/
  config/env.ts              the only place env vars are read
  theme/                     tokens (palette, type scale, spacing, radii, paper-cutout shadow), category/mode/rarity styles
  types/                     domain types
  i18n/strings.ts            translation-ready UI strings (English only today)
  data/                      demo regions + seeded places, demo people (all flagged isDemo)
  game/                      PURE rules, no React: progression (XP, levels, streaks, daily XP,
                             idempotent applyCompletion), questSchema (zod + safety filter),
                             localQuests, questStatus/hub state, leaderboard, geo, dates
  services/                  gemini, perceptron, photon, places (Overpass), location, storage
  store/useGameStore.ts      Zustand + AsyncStorage persist; orchestrates services, applies game rules
  hooks/useWorld.ts          derived world view (hubs, quests in range, distances)
  components/                Button, Paper (Card/Chip/Notice/ProgressBar/EmptyState), Critter (avatar art),
                             PinArt (collectible art), Markers, Confetti, map/GameMap(.web).tsx, …
  screens/                   Explore, QuestDetail, ActiveQuest, Verify, Reward, Party, Collection,
                             Leaderboard, Profile, RegionPicker
  navigation/                typed stack + tabs, custom paper tab bar
```

Key decisions:
- **Rewards are granted in exactly one place:** `applyCompletion()` is pure and idempotent, keyed by quest ID. Quest IDs are deterministic hashes of landmark and title, so regenerating the world after a restart can't re-award a completed quest.
- **Discovery is distance-based** (3 km radius). Check-in requires being within 120 m.
- **Quest generation never blocks.** Local quests always exist. Gemini output is validated per quest, and any landmark without a valid AI quest falls back to a local one.
- **Safety by construction.** A regex screen rejects trespass, roofs and fences, night meetups, isolated spots, spending money, contact details, photographing strangers, and political or religious-belief prompts. Social and party quests *must* carry a solo alternative or they're rejected. Night time suppresses daylight party quests and adds a daylight note.
- **Privacy.** Location is foreground-only at Balanced (≈100 m) accuracy. Other players appear only as "very near / nearby / in the area". Evidence photos are held in component state only and dropped after submission. In demo mode they're never uploaded.
- **Global.** Coordinate-based discovery, locale-aware distance/date/number formatting, metric/imperial from the device locale (overridable), local-time-zone day keys for daily XP and streaks, and Unicode-safe text clamping (code points, not UTF-16 units).
- **Animation** uses the core `Animated` API with the native driver (transform/opacity only), not Reanimated. That kept dependencies minimal and avoided Babel/worklets setup risk on a brand-new SDK. Confetti is `pointerEvents="none"` and never blocks taps.

## Quality checks

```bash
npm run typecheck   # tsc, strict + noUncheckedIndexedAccess
npm run lint        # eslint-config-expo (incl. React Compiler rules)
npm test            # jest-expo: 71 tests
```

The tests cover level thresholds and their inverse, streaks, daily XP pruning, idempotent completion, duplicate collectibles, party bonus, quest schema validation, unsafe-content rejection, solo-alternative enforcement, local generation for every category and region (including Unicode names), deterministic IDs, night behaviour, Gemini success/partial/malformed/HTTP-error/offline fallbacks (mocked fetch), the demo verifier's accept/reject, the party service (capacity 4, ready, chat, leave), leaderboard ranking, and a store-level end-to-end loop (accept → check-in gate → reject → complete once → persisted → reset → region switch).

## Verified vs not verified

- ✅ Typecheck, lint, and all 71 tests pass.
- ✅ Supabase schema, RLS, RPCs and the delete-account Edge Function were tested against the live project (see "Database").
- ✅ Web: sign-in screen, validation and a real wrong-password round-trip to Supabase.
- ✅ In a browser at phone size (Expo web): the first-run card, map board, quest detail, accept, the too-far check-in message, simulated walk, check-in, photo pick and preview, simulated reject then retry, accept → reward screen, collection, leaderboard, party (create/invite/ready/chat), profile, persistence across reload, and region switching all work.
- ⚠️ **Not run on a physical device or simulator yet.** Native map rendering (custom markers, pitch, Google map style on Android, `mutedStandard` on iOS), camera capture, GPS permission flows and haptics still need checking in Expo Go.
- ⚠️ The live Gemini, Perceptron and Overpass paths were only exercised with mocked `fetch` (Gemini) or not at all (Perceptron, Overpass), because no keys were available. The Perceptron request format follows docs.perceptron.inc (model `perceptron-mk1.5`). Confirm it at the Perceptron workshop.

## Hackathon notes (from the DubHacks '26 Hacker Guide)

- One title track, up to **3 sponsored side tracks**, unlimited non-sponsored side tracks. Our target list (Chef's Choice + SideShift + Perceptron + DubHacks NEXT + MLH Gemini/Backboard) needs trimming. Check which of these the organisers count as "sponsored" before submitting.
- **Chef's Choice** (title): creativity, games and interactive experiences, UI/UX. That's Thaw's core.
- **SideShift – Best Startup Idea**: open to any stack, and judges favour ideas with a distribution story (creators, social, spreadability). The share-invite loop and pins as shareable souvenirs are the hooks.
- **Perceptron**: the perception track uses their Mk/Isaac models through provided API access (localization, OCR, captioning…). `perceptron.ts` is where that plugs in.
- **MLH Best Use of Gemini API**: `gemini.ts`. **MLH Best Use of Backboard** is a separate prize, and Backboard is **not integrated**.
- **DubHacks NEXT**: listed with prizes in the guide, but its judging criteria weren't on the public guide pages. Ask an organiser.
- **Rules**: 70/30 rule (≥70% of code written during the event), public repo linked on Devpost, **draft submission by 10:30 PM Saturday**, final submission with a **video by 10:00 AM Sunday**, and at least one team member present at in-person judging.

All application code here was written for this project. Dependencies are open-source packages used under their licences. Map data © OpenStreetMap contributors (ODbL). Fonts: Fredoka and Nunito (SIL OFL) via `@expo-google-fonts`.
