# dubhacks26product

Thaw is a real-world quest game. This repo has three parts, and they are hosted separately.

| Folder | What it is | Where it runs |
| --- | --- | --- |
| `thaw/` | Expo React Native game | Its own app hosting, not Vercel |
| `meltmode-website/` | Marketing site and "play by text" signup | [https://dubhacks26product.vercel.app/](https://dubhacks26product.vercel.app/) |
| `photon/` | Spectrum iMessage service | A computer you leave running. It is not a Vercel function |

Start the game from `thaw/` with `npm install` and `npx expo start`. Start the website from `meltmode-website/` with `npm install` and `npm run dev`. Start messaging from `photon/` with `bun start`.

## How text signup works

The website form does not talk to Photon by itself. It only POSTs to `/api/public/signup`. Photon registers that phone as a shared Spectrum user and returns the iMessage number the person should text. Photon does not send the first text. The person taps the `sms:` link and messages that number from their own phone. Replies happen only while `bun start` is still running on the Photon machine, because that process holds the iMessage stream.

Two paths reach that same Photon route:

- **On your computer.** `npm run dev` in `meltmode-website/` proxies `/api/public/signup` to `http://127.0.0.1:3001`. No tunnel is required.
- **On the live Vercel site.** The browser still posts to the Vercel domain. `meltmode-website/api/public/signup.js` forwards that request, including the browser `Origin`, to `PHOTON_SIGNUP_URL`. That URL is a tunnel to the Photon process on `127.0.0.1:3001`.

Vercel cannot call `127.0.0.1` on a laptop. Photon also cannot move onto Vercel: it needs a long-lived Bun process and a SQLite file that survives restarts.

Step-by-step setup for the live site is in [meltmode-website/README.md](meltmode-website/README.md). Photon credentials, the origin allowlist, and the iMessage listener are in [photon/README.md](photon/README.md).

Do not put `PROJECT_ID`, `PROJECT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or `GEMINI_API_KEY` in the Vercel project or in any `VITE_` or `EXPO_PUBLIC_` variable. Those stay in `photon/.env`, which is not committed.

## Combined result

`Combined-Result` ports Supabase accounts from `Database-Changes` onto the `trinav` app. **Do not merge it to `main`.** Signed-in quests, email confirmation, server XP, and live iMessage still need testing. The full record is `docs/COMBINED-RESULT.md`.
