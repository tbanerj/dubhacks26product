# Photon demo rehearsal

Use two identities that are already on the Photon project's Users tab. Do not tell a judge that any phone can text one public number.

## Before judging

1. `cd photon && bun run messaging:doctor` shows `doctor_ready` without printing secrets.
2. `bun start` is the only Spectrum listener running.
3. `MESSAGING_PROACTIVE_ENABLED` stays `0` unless the reminder portion is part of the demo.
4. The migration `20261018010000_messaging_rewards.sql` is applied if the app should show the text reward.
5. The demo account is signed in. Settings → Play by text can reach `EXPO_PUBLIC_PHOTON_API_URL`.

## Live path

1. Tester A texts the route shown for them in the dashboard: a place name, then `1`, then one JPEG or PNG.
2. Thaw replies with the quest, then a check result. `Demo verification` means the photo was not sent to Gemini.
3. In the app, link with `LINK` and the code, confirm, and refresh. The pin and XP appear from Supabase, not from a number typed in the client.
4. Tester A texts `STOP`. Queued reminders do not send. `RESUME` does not undo `STOP`.
5. Tester B texts the same worker. Their quest and photos stay separate.

## If the provider is down

Say so. The local demo is `cd photon && bun run messaging:demo`. Those replies are labeled demo. Recorded fallback footage must be labeled the same way. Do not present a simulated photo pass as a live Gemini check.
