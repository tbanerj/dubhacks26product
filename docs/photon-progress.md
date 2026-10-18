# Photon integration progress

Updated after the local test run on 2026-10-17.

| Area | Implemented | Locally tested | Mocked | Live verified |
| --- | --- | --- | --- | --- |
| Audit | `docs/photon-repo-audit.md` | Read against the tree | | |
| PING and doctor | `PING` behind `THAW_DIAGNOSTICS=1`; `bun run messaging:doctor` | Unit test for PING. `doctor_ready` after Spectrum started and stopped | Doctor does not send or receive a message | No phone round trip |
| Commands and preferences | STOP, UNSUBSCRIBE, “stop texting me”, PAUSE, RESUME, REMINDERS, SCHEDULE, SETTINGS, UNLINK | Bun tests for STOP, RESUME, PAUSE | | No |
| Gemini photo check | `photon/src/game/verify.ts`. Live mode refuses to boot without `GEMINI_API_KEY` | Outage stub awards 0 XP. HEIC never calls the verifier | Demo transport still says `Demo verification` | No real photo was sent |
| App linking and shared XP | Play by text screen, bearer token, service-role RPC | Link expiry, reuse, and conflicting identity | Supabase write is skipped when the service-role key is absent | Migration not confirmed on the live project |
| Optional prompts | Scheduler, quiet hours, DST, kill switch, provider block | Bun tests, including a DST gap and a repeated hour | Prompts stay off unless `MESSAGING_PROACTIVE_ENABLED=1` | No |

## Commands

```sh
cd photon && bun test          # 41 pass after the last Photon-only run
cd photon && bun run typecheck
cd thaw && npm test            # 9 suites, 85 tests passed
```

A passing Bun suite does not prove iMessage routing.

## Still manual

1. In https://app.photon.codes, add each tester under the project Users tab. Use the phone or email on their iMessage account.
2. Open that project's iMessage route for each user. Do not invent one shared number.
3. Put `PROJECT_ID` and `PROJECT_SECRET` in `photon/.env` if they are not already there. Run `bun run messaging:doctor`, then `bun start`.
4. Set `THAW_DIAGNOSTICS=1` and text `PING` from a registered phone. Then send one JPEG or PNG. Expect a connection ack and a photo ack. This step is not done.
5. Apply `supabase/migrations/20261018010000_messaging_rewards.sql` in the Supabase SQL editor. Put `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `photon/.env` only.
6. Set `EXPO_PUBLIC_PHOTON_API_URL` in `thaw/.env` to a host the phone can reach, and set `THAW_API_HOST` if that host is not `127.0.0.1`.
7. For a live photo verdict, set `THAW_VERIFIER=live` and `GEMINI_API_KEY` on the Photon server. Leave the key out of Expo.
8. Read the current Free allowance on the dashboard before the demo. Do not buy credits or upgrade the plan.

## Known limits

- Text quests are the three templates in `photon/src/game/quests.ts`. Map quests still come from the app's Gemini writer.
- HEIC is refused with a resend instruction. It is not converted.
- A text player without an app account keeps XP in SQLite. Linking copies rewards once. If the chat is already linked to someone else, both histories stay separate.
- A message already accepted by the provider cannot be recalled by a later STOP.
- Group chats, voice, and SMS are out of scope.
