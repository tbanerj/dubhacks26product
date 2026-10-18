# Photon repository audit

Recorded from the tree on 2026-10-17. No secret values belong in this file.

## Layout

| Path | Role |
| --- | --- |
| `thaw/` | Expo app. Accounts, map quests, Gemini quest writing, Gemini photo checks, Supabase XP. |
| `photon/` | Bun worker. Stable Spectrum Cloud iMessage (`spectrum-ts` 12.11.0) and a local demo transport. SQLite is the conversation database. |
| `supabase/migrations/` | Postgres profiles, completions, collectibles, parties. `public.complete_quest` uses `auth.uid()` and a map landmark. |

There is no separate `server/` package. Photon is the messaging service. Do not add a second game engine.

## Reuse these

- Auth session: `thaw/src/services/auth.ts`, `thaw/src/services/supabase/client.ts`. The signed-in id is `session.user.id`.
- App photo check: `verifyEvidence` / `verifyLive` in `thaw/src/services/gemini.ts`. Accept when `match` is true and confidence is at least 0.45. A failed Gemini call must not become a live reward (`thaw/src/screens/VerifyScreen.tsx`).
- App XP: `thaw/src/services/cloud.ts` calls `complete_quest`. Amounts live in `private.base_xp`: easy 60, medium 90, hard 130. Client writes do not set XP.
- Text loop that already exists: `photon/src/messaging/photon.ts` (Spectrum `app.messages`, skip outbound and groups, store `space.phone`), `photon/src/game/engine.ts`, `photon/src/db/schema.ts`.
- Linking stand-in: `photon/src/game/linking.ts` and `photon/src/api/server.ts`. Auth was the header `x-thaw-dev-user`, and the API bound `127.0.0.1`.

## Missing before this integration

- `THAW_VERIFIER=live` refused to start. A Photon-transport photo that passed JPEG/PNG checks was treated as success.
- No Gemini call inside `photon/`.
- Commands not parsed: SETTINGS, PAUSE, RESUME, UNSUBSCRIBE, REMINDERS ON/OFF, SCHEDULE, UNLINK, PING. STOP already opted the player out. START cleared that opt-out.
- App settings had no Play by text screen. `EXPO_PUBLIC_PHOTON_RELAY_URL` posts party invites to `/invites`, which Photon does not implement.
- Text XP lived only in SQLite. `complete_quest` cannot record a text quest: it requires `auth.uid()` and a landmark.

## Integration choices

- Keep SQLite for conversation state, inbox, outbox, and text-only players.
- Copy a linked reward into the existing Supabase progress tables with a service-role RPC. Do not call `complete_quest` from Photon.
- Keep the three text quest templates. Map Gemini stays in the app.
- App calls use the player's Supabase access token. The dev header stays for demo tests only.
- Proactive prompts stay off unless `MESSAGING_PROACTIVE_ENABLED=1`.
