# Thaw

**The world gets warmer when you show up.**

Thaw is a real-world social adventure game. The map of wherever you are becomes a game board: public parks, libraries, squares, markets and public art turn into quest hubs. Accept a quest, walk there, check in, snap photo evidence, and earn XP plus an illustrated souvenir pin. Some quests are better with a party of 2–4, and every social quest has a solo option, so nobody has to approach a stranger.

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
| `EXPO_PUBLIC_GEMINI_API_KEY` | [Google AI Studio → Get API key](https://aistudio.google.com/apikey) (free tier is enough) | Quests near you are written by Gemini (`EXPO_PUBLIC_GEMINI_MODEL`, default `gemini-2.5-flash`) | Tap **↻ Refresh quests** on the map. Cards show an **AI** chip, and quest detail says "Quest written by Gemini". If the call fails, a yellow note on the map says why, and built-in quests are used. |
| `EXPO_PUBLIC_PERCEPTRON_API_KEY` | From the Perceptron team (DubHacks workshop) or their developer dashboard | Photo evidence is really analysed. Base URL `https://api.perceptron.inc/v1` and model `perceptron-mk1.5` are overridable | The verify screen's note changes from "Demo mode: verification is simulated" to "sent to Perceptron". Submit a matching photo (should pass) and an unrelated one (should fail with the model's observations). |
| `EXPO_PUBLIC_PHOTON_RELAY_URL` | URL of **our own** relay server (not built yet; see "Photon" below). The Photon key lives on that server, never in the app | **Share invite** also POSTs `{ "message": "..." }` to `<relay>/invites` | The party screen shows "Invite also sent through your Photon relay", or the relay's error. |
| `EXPO_PUBLIC_OVERPASS_URL` | Leave the default unless rate-limited; alternatives are listed at wiki.openstreetmap.org/wiki/Overpass_API | Source of real nearby places when using **Use my location** | Use my location → hubs have real local names and show "· OSM" in the hub card. |

> ⚠️ Anything prefixed `EXPO_PUBLIC_` is compiled into the app and can be extracted by anyone who has the build. Use throwaway or demo keys with spending caps for the hackathon, and rotate them afterwards.

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

Also run `npm run typecheck && npm run lint && npm test` before every push.

If something fails, note the step number, the platform, and a screenshot. JS errors appear in the terminal running `expo start`.

### 4. Production readiness

**Today the app is a hackathon demo, not a production app.** These are the remaining items, in priority order. None are done yet.

**Must-have before any public release**

1. **Backend proxy for AI keys.** Add a small server (Vercel/Cloudflare Functions, Supabase Edge Functions, etc.) with `POST /quests` → Gemini and `POST /verify` → Perceptron. Move the keys there, add per-user rate limiting, then change the URLs in `src/services/gemini.ts` and `src/services/perceptron.ts`. Remove `EXPO_PUBLIC_GEMINI_API_KEY` and `EXPO_PUBLIC_PERCEPTRON_API_KEY` from the app entirely.
2. **Accounts + server-side game state.** Today XP and pins live only on the device, so anyone can tamper with them. Add auth (Supabase Auth, Firebase Auth, or Clerk) and a database with tables for players, completions, collectibles and xp_by_day. Make the server the authority: verification and the `applyCompletion` rules (`src/game/progression.ts` is pure and portable) must run server-side. The client only displays results.
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
14. Server-generated, cached quests per place, so every player at the same spot sees the same quests and AI costs stay bounded.
15. Push notifications for party invites and streak reminders, opt-in only.

---

## What's real vs simulated

| Area | Without keys (demo) | With configuration |
|---|---|---|
| Places | Saved demo places for 6 cities on 5 continents, plus "Anywhere" sample spots (labelled as samples) | **Use my location** queries **OpenStreetMap (Overpass API)** live: no key, cached 24 h, rate-limited, attributed |
| Quests | Original local templates keyed to the *kind* of place (garden ≠ library ≠ market), time-of-day aware, deterministic IDs | **Gemini** (`generateContent`, JSON schema mode). Every AI quest is zod-validated and safety-filtered, and anything rejected is replaced by a local quest |
| Photo verification | **Transparent mock.** The UI says it's simulated, and the photo never leaves the device | **Perceptron** chat-completions API (`POST /v1/chat/completions`, image as a data URI), with timeout, one retry and a parsed verdict |
| Party / presence | Deterministic local lobby. Demo participants are always labelled "demo". Membership, ready states and chat work | See "Photon" below |
| Leaderboards | Local: your real progress vs labelled demo profiles. The app never calls this a global board | (backend needed) |

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
npm test            # jest-expo: 49 tests
```

The tests cover level thresholds and their inverse, streaks, daily XP pruning, idempotent completion, duplicate collectibles, party bonus, quest schema validation, unsafe-content rejection, solo-alternative enforcement, local generation for every category and region (including Unicode names), deterministic IDs, night behaviour, Gemini success/partial/malformed/HTTP-error/offline fallbacks (mocked fetch), the demo verifier's accept/reject, the party service (capacity 4, ready, chat, leave), leaderboard ranking, and a store-level end-to-end loop (accept → check-in gate → reject → complete once → persisted → reset → region switch).

## Verified vs not verified

- ✅ Typecheck, lint, and all 49 tests pass.
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
