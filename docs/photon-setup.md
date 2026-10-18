# Photon Free setup

Stable Spectrum Cloud on a regular Photon account at https://app.photon.codes. Do not use a beta SDK, a Photon Engine multiplayer key, or a local Messages database.

## Dashboard

1. Open the project settings and copy the project id and secret into `photon/.env` as `PROJECT_ID` and `PROJECT_SECRET`. Leave that file uncommitted.
2. Open the project's Users tab. Add each tester's real iMessage phone number or email. An unregistered recipient fails with `Target not allowed for this project`. That failure is permanent for the process until you restart after they are registered. Do not retry it in a loop, and do not buy credits.
3. Shared Free lines do not have one number for everyone. In the dashboard, open the iMessage route for each registered user. Do not hardcode a number in the app.
4. Check the project's current Free allowance and usage on the dashboard before a demo. This repo does not store that number.

## Server

```sh
cd photon
bun install
bun run messaging:doctor
bun start
```

`messaging:doctor` prints which variable names are set and whether Spectrum accepted the credentials. It does not print values, and it does not award XP.

| Name | Purpose |
| --- | --- |
| `PROJECT_ID`, `PROJECT_SECRET` | Spectrum Cloud credentials. `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` also work. |
| `THAW_TRANSPORT` | `photon` or `demo`. |
| `THAW_VERIFIER` | `demo` labels a simulated photo check. `live` requires `GEMINI_API_KEY` and refuses to boot without it. |
| `GEMINI_API_KEY` | Server-only photo check. Same confidence rule as the app: 0.45. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Verify the app's access token. |
| `SUPABASE_SERVICE_ROLE_KEY` | Copy a linked reward into Postgres. Never put this in Expo. |
| `THAW_API_HOST` | Default `127.0.0.1`. Set a LAN address only when a phone must call the API. |
| `THAW_DIAGNOSTICS` | `1` enables `PING`. |
| `MESSAGING_PROACTIVE_ENABLED` | `1` allows optional reminders. Default off. |
| `MESSAGING_ENABLED` | `0` or `false` turns the text loop off. |

Apply this on the Supabase project before expecting app XP from a text quest:

`supabase/migrations/20261018010000_messaging_rewards.sql`

`authenticated` and `anon` cannot execute `record_messaging_completion`.

## App

In `thaw/.env`, set `EXPO_PUBLIC_PHOTON_API_URL` to the Photon API, for example `http://192.168.1.20:3001`. Restart Expo. Settings → Play by text uses the signed-in session. It does not show a success state until the server answers.

## Troubleshooting

- Doctor says credentials are missing: fill `photon/.env` from project settings.
- `Target not allowed for this project`: add that exact iMessage identity under Users, then text again. Restart the worker after a block.
- The phone cannot open Play by text: the API is on `127.0.0.1` unless `THAW_API_HOST` is a reachable address.
- A photo reply says `Demo verification`: `THAW_VERIFIER` is `demo`.
- A photo reply says the check is unavailable: Gemini failed or the key is missing. The quest stays active and XP is unchanged.
