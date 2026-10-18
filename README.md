# dubhacks26product

Two apps live side by side:

- `thaw/` is the Expo React Native game.
- `photon/` is the Spectrum iMessage service.

Start the game from `thaw/` with `npm install` and `npx expo start`. Start messaging from `photon/` with `bun start`.

## Combined result

`Combined-Result` ports Supabase accounts from `Database-Changes` onto the `trinav` app. **Do not merge it to `main`.** Signed-in quests, email confirmation, server XP, and live iMessage still need testing. The full record is `docs/COMBINED-RESULT.md`.
