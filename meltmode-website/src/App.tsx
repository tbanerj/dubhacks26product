import { useEffect, useState } from 'react'
import './App.css'
import Home from './pages/Home'
import Demo from './pages/Demo'
import Download from './pages/Download'
import ByText from './pages/ByText'
import Privacy from './pages/Privacy'

// The menu. "path" is what shows after the # in the web address,
// for example yoursite.com/#/demo
const PAGES = [
  { path: '/', label: 'Home' },
  { path: '/demo', label: 'Demo' },
  { path: '/download', label: 'Download' },
  { path: '/text', label: 'Get it by text' },
]

// Reads which page we're on from the web address


// Your team. Put each person's name and LinkedIn web address
// between the quotes. Leave an address empty ('') to show just the name.
const TEAM = [
  { name: 'Ryan Panda', linkedin: 'https://www.linkedin.com/in/ryan-panda-5b021a352/?lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base_contact_details%3BVmS5Ce%2FuTaKnli1m0zxqMg%3D%3D' },
  { name: 'Thanika Puhazholi', linkedin: 'https://www.linkedin.com/in/thanikapuhazholi' },
  { name: 'Trinav Banerjee', linkedin: 'https://www.linkedin.com/in/trinavbanerjee' },
]
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

// The MeltMode logo: a gold tile with a melting drop (original artwork)
function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <rect width="36" height="36" rx="11" fill="#245C46" />
      <path d="M18 7c4.5 6.5 7.5 10 7.5 14.5a7.5 7.5 0 0 1-15 0C10.5 17 13.5 13.5 18 7z" fill="#F8F8F3" />
      <circle cx="15.5" cy="21.5" r="2" fill="#F4D06F" />
    </svg>
  )
}

export default function App() {
  const [path, setPath] = useState(getPath())

  // When the web address changes (a menu click or the Back button), show the new page
  useEffect(() => {
    const onChange = () => {
      setPath(getPath())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <a href="#/" className="brand" aria-label="MeltMode home">
            <Logo />
            <span>MeltMode</span>
          </a>
          <nav className="site-nav" aria-label="Main">
            {PAGES.map((page) => (
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
        </div>
      </header>

      <main>{renderPage(path)}</main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <div className="brand">
              <Logo />
              <span>MeltMode</span>
            </div>
            <p>Real-world quests that turn strangers into friends.</p>
          </div>

          <div className="footer-col">
            <h3>Explore</h3>
            {PAGES.map((page) => (
              <a key={page.path} href={'#' + page.path}>
                {page.label}
              </a>
            ))}
          </div>

            <div className="footer-col">
            <h3>The team</h3>
            {TEAM.map((person) =>
              person.linkedin ? (
                <a key={person.name} href={person.linkedin} target="_blank" rel="noreferrer" className="team-link">
                  {person.name}
                </a>
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
        <div className="container footer-bottom">
          <span>© 2026 MeltMode. All rights reserved.</span>
          <a href="#/privacy">Privacy policy</a>
        </div>      
        </footer>
    </>
  )
}