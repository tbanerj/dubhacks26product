# MeltMode website

The website for MeltMode, a real-world quest game that helps people in Seattle meet new friends.
It has a home page, a playable demo, download links, Photon-backed text-message sign-up and a privacy policy.

The frontend is built with React, TypeScript and Vite. Text-message sign-up calls the Photon Bun service;
the Spectrum project credentials must remain on that server and must never be added to the website bundle.

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

Pages are reached with links like `#/demo`, so the site works on any static host
(Netlify, Vercel, GitHub Pages) as a frontend. For text signup to work after deployment, configure a
public HTTPS reverse-proxy route from the site to the long-running Photon Bun service. Keep the Bun API
on loopback/private networking, set `THAW_SIGNUP_ALLOWED_ORIGINS` to the exact public frontend origin
(including when a proxy terminates HTTPS), and provide project credentials as server secrets. See `../photon/README.md` for the
server setup and proxy requirements. A static host by itself cannot provision Spectrum users.

## Editing content

Most words live in lists at the top of each page file, so you can change text without touching the layout.

Still to fill in:

- `APP_STORE_URL` and `PLAY_STORE_URL` in `src/pages/Download.tsx` once the app is published
