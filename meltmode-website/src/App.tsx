import { useEffect, useRef, useState } from 'react'
import './App.css'
import Home from './pages/Home'
import Demo from './pages/Demo'
import Download from './pages/Download'
import ByText from './pages/ByText'
import Privacy from './pages/Privacy'
import { scene, startFrost } from './lib/frost'
import { reducedMotion, scrollToTop, ScrollTrigger } from './lib/smooth'

// The menu. "path" is what shows after the # in the web address,
// for example yoursite.com/#/demo
const PAGES = [
  { path: '/', label: 'Home' },
  { path: '/demo', label: 'Demo' },
  { path: '/download', label: 'Download' },
  { path: '/text', label: 'Play by text' },
]

// Your team. Put each person's name and LinkedIn web address
// between the quotes. Leave an address empty ('') to show just the name.
const TEAM = [
  { name: 'Ryan Panda', linkedin: 'https://www.linkedin.com/in/ryan-panda-5b021a352/' },
  { name: 'Thanika Puhazholi', linkedin: 'https://www.linkedin.com/in/thanikapuhazholi' },
  { name: 'Trinav Banerjee', linkedin: 'https://www.linkedin.com/in/trinavbanerjee' },
]

// Reads which page we're on from the web address
function getPath() {
  const path = window.location.hash.replace('#', '')
  return path === '' ? '/' : path
}

// Picks the page to show for each path
function renderPage(path: string) {
  switch (path) {
    case '/demo':
      return <Demo />
    case '/download':
      return <Download />
    case '/text':
      return <ByText />
    case '/privacy':
      return <Privacy />
    default:
      return <Home />
  }
}

// The MeltMode mark: a drop that's still ice on top and warm where it's melting
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="logo-melt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="currentColor" />
          <stop offset="0.75" stopColor="#FFB84D" />
          <stop offset="1" stopColor="#E8497F" />
        </linearGradient>
      </defs>
      <path d="M32 6c9.5 13 15.5 20.5 15.5 30a15.5 15.5 0 0 1-31 0C16.5 26.5 22.5 19 32 6z" fill="url(#logo-melt)" />
    </svg>
  )
}

export default function App() {
  const [path, setPath] = useState(getPath())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasGL, setHasGL] = useState(true)

  // When the web address changes (a menu click or the Back button), show the new page
  useEffect(() => {
    const onChange = () => {
      setPath(getPath())
      scrollToTop()
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  // The frost background lives behind every page
  useEffect(() => {
    const stop = startFrost(canvasRef.current!, reducedMotion)
    if (!stop) setHasGL(false)
    return () => stop?.()
  }, [])

  // Subpages sit on the frozen, dark version; the home page takes over these itself
  useEffect(() => {
    if (path === '/') return
    scene.melt = 0
    scene.lit = 0
    scene.active = true
    scene.origin = { x: 0.5, y: 0.35 }
    document.documentElement.dataset.tone = 'dark'
    document.documentElement.style.removeProperty('--bg')
    document.documentElement.style.removeProperty('--fg')
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [path])

  const isHome = path === '/'

  return (
    <>
      <canvas ref={canvasRef} className="frost-canvas" aria-hidden="true" />
      {!hasGL && <div className="frost-fallback" aria-hidden="true" />}

      <header className="site-header">
        <div className="header-inner">
          <a href="#/" className="brand" aria-label="MeltMode home">
            <Logo />
            <span>MeltMode</span>
          </a>
          <nav className="site-nav" aria-label="Main">
            {PAGES.slice(1).map((page) => (
              <a
                key={page.path}
                href={'#' + page.path}
                className={page.path === path ? 'nav-link active' : 'nav-link'}
                aria-current={page.path === path ? 'page' : undefined}
              >
                {page.label}
              </a>
            ))}
          </nav>
          <a className="header-cta" href="#/demo">Play a quest</a>
        </div>
      </header>

      <main className={isHome ? 'main-home' : 'main-sub'}>{renderPage(path)}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-mark">
            <Logo size={44} />
            <p>Real-world quests that turn strangers into friends. Made in Seattle.</p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h3>Explore</h3>
              {PAGES.map((page) => (
                <a key={page.path} href={'#' + page.path}>{page.label}</a>
              ))}
            </div>
            <div className="footer-col">
              <h3>The team</h3>
              {TEAM.map((person) =>
                person.linkedin ? (
                  <a key={person.name} href={person.linkedin} target="_blank" rel="noreferrer">{person.name}</a>
                ) : (
                  <span key={person.name}>{person.name}</span>
                )
              )}
            </div>
            <div className="footer-col">
              <h3>Contact</h3>
              <a href="mailto:trinavbanerjee@gmail.com">trinavbanerjee@gmail.com</a>
            </div>
          </div>
          <div className="footer-word" aria-hidden="true">MeltMode</div>
          <div className="footer-bottom">
            <span>© 2026 MeltMode</span>
            <a href="#/privacy">Privacy policy</a>
          </div>
        </div>
      </footer>
    </>
  )
}
