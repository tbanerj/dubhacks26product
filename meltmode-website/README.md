# Thaw website

The website for Thaw, a real-world quest game that helps people in Seattle meet new friends.
It has a home page, a playable demo, download links, text-message sign-up and a privacy policy.

The frontend is built with React, TypeScript and Vite. It has no database and no `VITE_` environment variables. Text-message sign-up calls the Photon Bun service; the Spectrum project credentials must remain on that server and must never be added to the website bundle.

## Run it on your computer

You need [Node.js](https://nodejs.org) installed.

```sh
npm install      # first time only
npm run dev      # start the site at http://localhost:5173
```

For local text-signup testing, start the Photon service separately with `THAW_TRANSPORT=photon`,
`PROJECT_ID`, and `PROJECT_SECRET` set in `photon/.env`. The Vite dev server proxies
`/api/public/signup` to the API on `127.0.0.1:3001`. Signup fails with a visible error unless the
backend is running against a configured Spectrum project.

A Photon Free project is enough. Signup registers the submitted phone as a shared project user
and the success button links to the pool number Spectrum assigns (`sms:+1...`). It does not send
a text. The person messages that number from an iPhone, and the Photon process replies.

Other commands:

- `npm run build`: make the finished site in the `dist/` folder, ready to put online
- `npm run preview`: view the built site locally
- `npm run lint`: check the code for mistakes

## Where things are

| File | What it is |
|---|---|
| `src/App.tsx` | Header, footer, menu, team list and page switching |
| `src/pages/Home.tsx` | The home page |
| `src/pages/Demo.tsx` | The interactive demo |
| `src/pages/Download.tsx` | App store links |
| `src/pages/ByText.tsx` | Text-message sign-up form |
| `src/pages/Privacy.tsx` | Privacy policy |
| `src/index.css` | Colours, font, spacing and shared styles |
| `api/public/signup.js` | Vercel proxy from the live site to `PHOTON_SIGNUP_URL` |
| `vite.config.ts` | Local-only proxy from `/api/public/signup` to `127.0.0.1:3001` |

Pages are hash routes, so the site works as a static frontend:

| Hash | Page |
| --- | --- |
| `#/` | Home |
| `#/demo` | Interactive demo |
| `#/download` | App store links |
| `#/text` | Text-message sign-up |
| `#/privacy` | Privacy policy (footer only) |

Text signup on the live site needs the proxy below. A static host by itself cannot register Spectrum users. The site does not store signups, accounts, or quest progress.

## Live site on Vercel

The deployed site is [https://dubhacks26product.vercel.app/](https://dubhacks26product.vercel.app/).
Set the Vercel project's root directory to `meltmode-website`. There is no `vercel.json` in this repo; the project settings live in the Vercel dashboard. The build is the Vite static site plus one serverless function, `api/public/signup.js`. That function reads `PHOTON_SIGNUP_URL` and nothing else. Photon stays on a computer you control. The Expo app is hosted on its own and does not use this proxy.

The form in `src/pages/ByText.tsx` always calls `fetch('/api/public/signup')` on the site's own origin.
Locally, the Vite proxy in `vite.config.ts` sends that path to `http://127.0.0.1:3001`.
On Vercel, `api/public/signup.js` does the same job: it POSTs the body to `PHOTON_SIGNUP_URL` and
forwards the browser `Origin` header. Photon checks that origin. The function does not add CORS headers,
and the page must not call the tunnel URL directly.

Signup on the public site works only while all of the following are true:

1. `bun start` is running in `photon/` with `THAW_TRANSPORT=photon`, `PROJECT_ID`, and `PROJECT_SECRET`.
2. `photon/.env` allows the live site. Setting this variable replaces the localhost defaults, so keep the local origins in the same list:

   ```
   THAW_SIGNUP_ALLOWED_ORIGINS=https://dubhacks26product.vercel.app,http://localhost:5173,http://127.0.0.1:5173
   ```

   Restart `bun start` after changing it. Leave `THAW_API_HOST=127.0.0.1`. There is no wildcard: a Vercel preview URL is a different origin and is rejected until you add that exact origin.
3. A tunnel is forwarding public HTTPS to the local Photon port. From another terminal, while `bun start` is up:

   ```sh
   cloudflared tunnel --url http://127.0.0.1:3001
   ```

   Cloudflare prints a host such as `https://something.trycloudflare.com`. That host changes every time you start a quick tunnel.
4. The Vercel project has this environment variable, using the host from the tunnel, and the site has been redeployed after `api/public/signup.js` was added:

   ```
   PHOTON_SIGNUP_URL=https://something.trycloudflare.com/api/public/signup
   ```

   Update that variable whenever the tunnel host changes. An ngrok reserved domain stays the same across restarts. The value must be `https`. If it is missing or the tunnel is down, the form shows signup unavailable.

Photon credentials stay in `photon/.env`. Do not add `PROJECT_SECRET` to Vercel.

After a successful signup, the page shows an `sms:` link to the number Spectrum assigned. Text replies still require the local `bun start` process. The Photon dashboard has no webhook URL to configure.

One limit of the tunnel: Photon counts signup attempts by the connecting IP, and every live signup arrives from the tunnel. The cap is 5 attempts per 10 minutes for the whole site while the tunnel is in use.

## Editing content

Most words live in lists at the top of each page file, so you can change text without touching the layout.

Still to fill in:

- `APP_STORE_URL` and `PLAY_STORE_URL` in `src/pages/Download.tsx` once the app is published. Both are still empty strings.
