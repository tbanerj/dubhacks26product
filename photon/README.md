# Thaw on Photon

Text Thaw and it will help you pick a small public adventure, send one photo, and earn XP and a collectible. The tagline is "The world gets warmer when you show up."

This folder is the messaging service. The Expo app lives in `thaw/`. The phone connection is stable Spectrum Cloud iMessage (`spectrum-ts` 12.11.0), not Photon Engine and not the Photon beta API.

- Docs: https://photon.codes/docs/spectrum-ts/getting-started
- iMessage provider: https://photon.codes/docs/spectrum-ts/providers/imessage
- Dashboard: https://app.photon.codes

## What talks to Photon

`src/messaging/photon.ts` is the only live adapter. It listens to Spectrum's message stream, ignores outbound echoes and group chats, and sends replies with `space.send`. After a restart it loads the saved conversation id and serving line and sends through `space.get`. Quest rules, rewards, and photo checks do not import Spectrum.

`THAW_TRANSPORT=demo` uses the same rules with two fictional players, Ada and Ben. They are not nearby people.

## Setup

Requirements: Bun 1.4 or newer. SQLite is built into Bun. This process does not run Postgres. Linked rewards can call the cloud Supabase project when the service-role key is set. Dashboard steps are in [docs/photon-setup.md](../docs/photon-setup.md).

```sh
cd photon
bun install
```

Copy `.env.example` to `.env` if you do not already have one. For live iMessage, set `PROJECT_ID` and `PROJECT_SECRET` from the project Settings page. Do not commit `.env`.

| Variable | Where it lives | Purpose |
| --- | --- | --- |
| `PROJECT_ID`, `PROJECT_SECRET` | Server only | Stable Spectrum credentials. `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` are aliases and win when both are set. |
| `THAW_TRANSPORT` | Server | `photon` or `demo`. Defaults to `photon` when a project id is set. |
| `THAW_VERIFIER` | Server | `demo` labels a simulated photo check. `live` starts only when `GEMINI_API_KEY` is set, and refuses to boot without it. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Server only | Live photo checks. Model default `gemini-3.5-flash-lite`. Never put this key in the Expo app or on Vercel. |
| `THAW_DATABASE_PATH` | Server | SQLite file. Default `data/thaw.sqlite`. Gitignored under `data/`. |
| `THAW_MEDIA_DIR` | Server | Private photo files. Default `data/media`. |
| `PORT` | Server | Local API, default `3001`, bound to `THAW_API_HOST` (`127.0.0.1` by default). |
| `THAW_SIGNUP_ALLOWED_ORIGINS` | Server | Exact `Origin` values for `POST /api/public/signup`, comma-separated. Unset allows only `http://localhost:5173` and `http://127.0.0.1:5173`. Setting it replaces those defaults, so keep the local origins in the list when you add `https://dubhacks26product.vercel.app`. |
| `THAW_DEV_API` | Server | `1` enables the development linking header. Unset is on for `demo` and off for `photon`. |
| `THAW_DIAGNOSTICS` | Server | `1` enables `PING`. It does not award XP. |
| `MESSAGING_ENABLED` | Server | `0` or `false` turns the text loop off. Otherwise on. |
| `MESSAGING_PROACTIVE_ENABLED` | Server | `1` allows optional prompts. Default off. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server only | Validate the app's Bearer token against Supabase Auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Copy a linked reward into Postgres. Without it, sync does not run. Never put this in Expo. |
| `THAW_MAX_IMAGE_BYTES`, `THAW_MAX_IMAGE_PIXELS`, `THAW_MEDIA_RETENTION_HOURS`, `THAW_DEFAULT_TIMEZONE` | Server | Defaults: 10 MB, 20 million pixels, 24 hours, `America/Los_Angeles`. Thaw does not guess a timezone from a phone number. |

Nothing from this service is safe to put in a public client bundle. The development header `x-thaw-dev-user` is not production login.

## Commands

```sh
bun run messaging:doctor      # print which variable names are set; does not print values or award XP
bun run messaging:seed        # create the local database
bun run messaging:demo        # text as Ada or Ben, no credentials
bun run messaging:dev         # photon if credentials exist, otherwise demo
bun start                     # same as messaging:dev
bun run dev                   # bun --watch src/index.ts
bun run messaging:test        # unit tests
bun run typecheck
bun run messaging:reset-demo  # delete demo-scoped players only
```

Demo CLI commands: `/as ada`, `/as ben`, `/scenario success|mismatch|unavailable`, `/photo`, `/reset`, `/quit`.

`/scenario` only works in the demo transport. A real iMessage cannot type its way into a passing photo check.

## Play by iMessage

1. Stop any older `bun start` so only one stream is connected.
2. Run `bun start` from this folder.
3. In the Photon dashboard, open the project's iMessage line. On a shared plan, different people can be routed through different numbers. Do not hardcode one number.
4. Shared plans must list each opted-in tester as a project user before Thaw can reply. The website signup route does that registration. Adding a Thaw profile does not. If a reply fails with `Target not allowed for this project`, the phone was not registered; sign up again or add that phone on the dashboard, then text again.
5. Text the line: a place, then `1`, `2`, or `3`, then one JPEG or PNG.
6. The result starts with `Demo verification` until a real checker is configured.

Group chats are ignored. Thaw does not read or share anyone's live location.

## Website signup on the Free plan

Photon Free uses a shared pool of iMessage numbers, not a dedicated Business line. A shared line refuses to message anyone who is not a project user (`Target not allowed for this project`).

`POST /api/public/signup` is the Free-plan registration. It calls Stable Spectrum `POST /projects/{projectId}/users/` with `{ "type": "shared", "phoneNumber": "<E.164>" }`. Spectrum records that phone as a project user and assigns one pool number in `assignedPhoneNumber`. The same phone submitted again returns the same assignment. This service does not store the phone and does not send a message.

The website button is an `sms:` link to that assigned number. The person texts it from the phone they registered. The listener in this process replies with the quest welcome. Leave `bun start` running; a request that returns immediately cannot hold the iMessage stream.

`type: "dedicated"` is the Business-line API and is not used. Do not hardcode one Thaw number: on a shared plan each person can be routed through a different pool number.

If the project's shared-user cap is full, Spectrum rejects the create and the site shows signup unavailable. Raise the cap or remove an old user in the Photon dashboard.

Keep this process on `127.0.0.1`. The live website does not run Photon. Vercel calls a tunnel, and the tunnel calls this process.

For [https://dubhacks26product.vercel.app/](https://dubhacks26product.vercel.app/), set:

```
THAW_SIGNUP_ALLOWED_ORIGINS=https://dubhacks26product.vercel.app,http://localhost:5173,http://127.0.0.1:5173
```

Restart `bun start` after that change. Then open a tunnel to port 3001 and set the Vercel variable `PHOTON_SIGNUP_URL` to `https://<tunnel-host>/api/public/signup`. The site function `thaw-website/api/public/signup.js` forwards the browser `Origin` to that URL. Full steps are in `../thaw-website/README.md`. A preview deployment origin has to be added explicitly. There is no wildcard.

Local `npm run dev` in `thaw-website/` still proxies straight to `127.0.0.1:3001` and does not need the tunnel.

## Photos

JPEG and PNG are accepted. The checker reads the file bytes, rejects empty files, files over `THAW_MAX_IMAGE_BYTES` (10 MB), and images over `THAW_MAX_IMAGE_PIXELS`. JPEG comment and EXIF-style APP segments are dropped from the stored copy. PNG ancillary chunks are dropped.

HEIC is detected and refused with a resend instruction. It is not converted. Automated tests cover a 1×1 PNG, a tiny JPEG, HEIC detection, and an oversized frame. A physical iPhone send was not re-run in this change.

Stored files are removed after `THAW_MEDIA_RETENTION_HOURS` (24). The quest result stays. Deleting Thaw's copy does not delete the picture from Messages or from Photon.

A photo with no active quest is not checked and does not award XP.

## Rewards and reminders

XP and collectibles are written in one database transaction. Each quest pays once. A failed send keeps the reward and retries the reply up to 5 times. Timeout and network errors are stored as `delivery_unknown` and retried. This is not exactly-once delivery.

`REMIND 15` stores one reminder for the active quest. A newer request replaces it. Completion, `CANCEL`, `STOP`, or a reminder more than 6 hours late cancels it. The process checks the database every 15 seconds, including after a restart.

`STOP` opts the player out and suppresses queued sends, including reminders. `START` lets the player continue, and it does not turn reminders back on. `RESUME` clears a temporary pause only. Earned progress stays.

## App linking

`PlayByTextScreen` in the Expo app is registered, and nothing in Settings or You navigates to it. When that screen runs, it sends the signed-in Supabase access token to this API. Set `EXPO_PUBLIC_PHOTON_API_URL` in `thaw/.env` to a host the phone can reach. With `THAW_DEV_API=1`, local tests can still send `x-thaw-dev-user`. That header is not production login.

- `GET /health`, `GET /ready`, and `POST /api/public/signup` (no auth)
- `GET /api/me/messaging` and `GET /api/me/progress`
- `POST /api/me/messaging/link-token` (and `/link`) issues an 8-character code for 10 minutes
- `GET /api/me/messaging/link-status`
- text `LINK` and that code
- `POST /api/me/messaging/link-confirm`
- `PATCH /api/me/messaging/preferences`
- `DELETE /api/me/messaging/link` drops future app access and does not erase earned history

Bearer auth checks the access token with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. A linked reward is copied into Supabase only when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both set. Apply `supabase/migrations/20261018010000_messaging_rewards.sql` first. That RPC is service-role only. Five failed code attempts lock that chat for the code window. Codes are stored as hashes.

## Logs and shutdown

Logs are JSON on stdout. They include event names and message ids, not message text, photos, or credentials. `SIGINT` or `SIGTERM` closes the Spectrum stream.

Run this as a long-lived Bun process. Do not put the listener behind a request that returns immediately. Photon webhooks are not enabled.

The SQLite file and `data/media` must live on a disk that survives restarts. A container's ephemeral disk is not enough for photos or quest state.

## Not wired

- Gemini quest writing in this service. Three local templates are used for every place. The Expo app still writes map quests with Gemini.
- Outgoing collectible images.
- Group chats, voice, and SMS.

Live photo checks run when `THAW_VERIFIER=live` and `GEMINI_API_KEY` is set on this server. Without that key the process refuses to start, instead of treating a photo as a pass. Demo mode still says `Demo verification`.

## Tests

`bun run messaging:test` covers the local loop: first contact, two players, ambiguous places, stable quest numbers across a restart, photo-before-quest, one reward, duplicates, mismatch, unavailable verification, replay refusal, cancel during verification, STOP, reminder delivery, bad images, link codes, and media cleanup.

Live handset delivery was proven earlier for the text echo. This build has not been rechecked on a phone after the quest loop replaced that echo.
