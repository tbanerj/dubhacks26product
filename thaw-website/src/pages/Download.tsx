import './Download.css'

/* ---------------------------------------------------------------
   When the app is published, paste the real store link here.
   While the link is empty (''), the button says "Coming soon".
---------------------------------------------------------------- */
const APP_STORE_URL = ''

type Platform = {
  name: string
  store: string
  url: string
  note: string
}

const PLATFORMS: Platform[] = [
  {
    name: 'iPhone',
    store: 'App Store',
    url: APP_STORE_URL,
    note: 'For iPhone. Download from the App Store once we launch.',
  },
]

// A simple phone drawing (not the Apple logo)
function PhoneIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <rect x="14" y="4" width="28" height="48" rx="9" fill="#123A2D" />
      <rect x="17" y="9" width="22" height="36" rx="6" fill="#DDECD0" />
      <rect x="23" y="11" width="10" height="3" rx="1.5" fill="#123A2D" />
      <circle cx="28" cy="28" r="6" fill="#F4D06F" />
    </svg>
  )
}

export default function Download() {
  return (
    <>
      <section className="container download-page">
        <div className="download-head">
          <span className="pill">Download</span>
          <h1>Get Thaw on your phone</h1>
          <p>
            Thaw is coming soon to iPhone. We’ll add the download link here the moment the app is
            live.
          </p>
        </div>

        <div className="platforms">
          {PLATFORMS.map((p) => (
            <div className="platform" key={p.name}>
              <div className="platform-art">
                <PhoneIcon />
              </div>
              <h2>{p.name}</h2>
              <p>{p.note}</p>

              {p.url ? (
                <a className="btn btn-dark store-btn" href={p.url} target="_blank" rel="noreferrer">
                  Download on {p.store}
                </a>
              ) : (
                <button className="btn store-btn coming-soon" disabled>
                  <span className="soon-dot"></span>
                  Coming soon
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="alternatives">
          <div className="alt">
            <h3>Can’t wait?</h3>
            <p>Play a quest right now in your browser. No download needed.</p>
            <a className="btn btn-primary" href="#/demo">Try the demo</a>
          </div>
          <div className="alt">
            <h3>No room for another app?</h3>
            <p>Get quests by text message instead, straight to your phone.</p>
            <a className="btn btn-light" href="#/text">Play by text</a>
          </div>
        </div>
      </section>
    </>
  )
}