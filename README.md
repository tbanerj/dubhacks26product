# dubhacks26product

Thaw is a real-world quest game. This repo has five product locations, and they are hosted separately.

| Folder | What it is | Where it runs |
| --- | --- | --- |
| `thaw/` | Expo React Native game | Expo Go on your machine, or a TestFlight / APK build. It is not a Vercel app |
| `meltmode-website/` | Marketing site and "play by text" signup | [https://dubhacks26product.vercel.app/](https://dubhacks26product.vercel.app/) |
| `photon/` | Spectrum iMessage service | A computer you leave running. It is not a Vercel function |
| `supabase/` | Postgres schema and the delete-account function | A cloud Supabase project. This repo has no local Supabase stack |
| `docs/` | Setup notes | Phone builds, Photon setup, and the merge record |

Start the game from `thaw/` with `npm install` and `npx expo start`. Start the website from `meltmode-website/` with `npm install` and `npm run dev`. Start messaging from `photon/` with `bun start`. Apply the SQL files in `supabase/migrations/` on the cloud project before expecting accounts, parties, or text-quest XP to save.

Phone builds that do not need this Mac are in [docs/thaw-native.md](docs/thaw-native.md). Photon credentials and the iMessage listener are in [photon/README.md](photon/README.md) and [docs/photon-setup.md](docs/photon-setup.md).

## Where data lives

Signed-in progress lives in Supabase: profiles, stats, completions, collectibles, daily XP, and parties. The phone also keeps a cache in AsyncStorage (`thaw-game-v3`). Live quest XP is written by the `complete_quest` database function after the app accepts a photo with Gemini.

Photon keeps its own quest state in `photon/data/thaw.sqlite` and photo files in `photon/data/media`. Both are gitignored and must sit on a disk that survives restarts. Website signup does not store the phone number. Spectrum keeps the project user, and Photon returns the iMessage number that person should text.

The website stores nothing.

A linked text quest is copied into the same Supabase tables only when `photon/.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, after `supabase/migrations/20261018010000_messaging_rewards.sql` is applied.

## How text signup works

The website form does not talk to Photon by itself. It only POSTs to `/api/public/signup`. Photon registers that phone as a shared Spectrum user and returns the iMessage number the person should text. Photon does not send the first text. The person taps the `sms:` link and messages that number from their own phone. Replies happen only while `bun start` is still running on the Photon machine, because that process holds the iMessage stream.

Two paths reach that same Photon route:

- **On your computer.** `npm run dev` in `meltmode-website/` proxies `/api/public/signup` to `http://127.0.0.1:3001`. No tunnel is required.
- **On the live Vercel site.** The browser still posts to the Vercel domain. `meltmode-website/api/public/signup.js` forwards that request, including the browser `Origin`, to `PHOTON_SIGNUP_URL`. That URL is a tunnel to the Photon process on `127.0.0.1:3001`.

Vercel cannot call `127.0.0.1` on a laptop. Photon also cannot move onto Vercel: it needs a long-lived Bun process and a SQLite file that survives restarts.

Step-by-step setup for the live site is in [meltmode-website/README.md](meltmode-website/README.md).

## Secrets

Do not put `PROJECT_ID`, `PROJECT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or the Photon `GEMINI_API_KEY` in the Vercel project or in any `VITE_` or `EXPO_PUBLIC_` variable. Those stay in `photon/.env`, which is not committed. The only Vercel variable for signup is `PHOTON_SIGNUP_URL`.

The Expo app does use `EXPO_PUBLIC_*` values. The Supabase publishable key is meant for the client; row-level security protects the rows. `EXPO_PUBLIC_GEMINI_API_KEY` is compiled into the app bundle, so anyone with the build can extract it.

## Merge record

Accounts, parties, and server XP were merged onto `main` from `Combined-Result`. [docs/COMBINED-RESULT.md](docs/COMBINED-RESULT.md) is the record of that merge. These checks in that file were not re-verified from the repo: whether `supabase/migrations/20261018000000_client_complete_quest.sql` is applied on the live project, a real signed-in quest, email delivery, a real party, and delete-account against the deployed function.
