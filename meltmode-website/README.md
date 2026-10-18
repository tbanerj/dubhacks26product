# MeltMode website

The website for MeltMode, a real-world quest game that helps people in Seattle meet new friends.
It has a home page, a playable demo, download links, text-message sign-up and a privacy policy.

Built with React, TypeScript and Vite. There's no backend: it's a static site.

## Run it on your computer

You need [Node.js](https://nodejs.org) installed.

```sh
npm install      # first time only
npm run dev      # start the site at http://localhost:5173
```

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
(Netlify, Vercel, GitHub Pages) with no extra setup.

## Editing content

Most words live in lists at the top of each page file, so you can change text without touching the layout.

Still to fill in:

- `APP_STORE_URL` and `PLAY_STORE_URL` in `src/pages/Download.tsx` once the app is published
- `SIGNUP_ENDPOINT` in `src/pages/ByText.tsx` once the text sign-up server is ready
  (never put an API key in this code: everything here is public)
