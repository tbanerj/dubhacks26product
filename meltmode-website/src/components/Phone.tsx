import { useEffect, useState } from 'react'
import { Logo } from '../App'
import './Phone.css'

// A phone built from CSS: a stack of thin slices gives it a real edge when it turns,
// and every screen inside is plain HTML, so the home page story can animate any
// part of it. Class names here are the hooks the story uses.

const EDGE_SLICES = 14

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/, '')
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return { time, date }
}

function StatusBar({ time }: { time: string }) {
  return (
    <div className="ph-status">
      <span>{time}</span>
      <span className="ph-status-icons" aria-hidden="true">
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor" /><rect x="4.5" y="5" width="3" height="6" rx="1" fill="currentColor" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="currentColor" /><rect x="13.5" y="0" width="3" height="11" rx="1" fill="currentColor" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" fill="none" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" /><rect x="23" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" /></svg>
      </span>
    </div>
  )
}

// A simple neighborhood map: streets, a park, the lake edge
function MapArt() {
  return (
    <svg className="ph-map" viewBox="0 0 320 660" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="660" fill="#EEECE7" />
      <path d="M-20 520 C 60 470, 120 560, 210 500 S 340 470, 360 430 L 360 700 L -20 700 Z" fill="#CFE0F2" />
      <rect x="168" y="150" width="120" height="96" rx="18" fill="#DCE8D5" />
      <g stroke="#FFFFFF" strokeWidth="14" strokeLinecap="round" fill="none">
        <path d="M-10 120 L 340 90" />
        <path d="M-10 300 L 340 270" />
        <path d="M-10 420 L 340 400" />
        <path d="M70 -10 L 110 700" />
        <path d="M150 -10 L 160 480" />
        <path d="M250 -10 L 230 480" />
      </g>
      <g stroke="#FFFFFF" strokeWidth="5" fill="none" opacity="0.9">
        <path d="M-10 210 L 340 185" />
        <path d="M-10 360 L 340 335" />
        <path d="M200 -10 L 196 480" />
      </g>
      <path d="M40 330 Q 140 250 228 198" stroke="#15161A" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" fill="none" className="ph-route" />
    </svg>
  )
}

function CameraScene() {
  return (
    <svg className="ph-cam-scene" viewBox="0 0 320 660" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="cam-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7C9A5" />
          <stop offset="0.55" stopColor="#F59F8B" />
          <stop offset="1" stopColor="#7E5C8C" />
        </linearGradient>
      </defs>
      <rect width="320" height="660" fill="url(#cam-sky)" />
      <circle cx="226" cy="190" r="34" fill="#FFE2B8" opacity="0.9" />
      <path d="M0 420 L 60 360 L 110 400 L 170 330 L 240 390 L 320 340 L 320 660 L 0 660 Z" fill="#5A4170" opacity="0.55" />
      {/* the fountain everyone found a detail on */}
      <ellipse cx="160" cy="520" rx="120" ry="26" fill="#3C2B4D" />
      <rect x="146" y="380" width="28" height="140" rx="6" fill="#2D2040" />
      <path d="M160 380 C 120 360, 96 400, 84 470 M160 380 C 200 360, 224 400, 236 470" stroke="#BFE0FF" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8" />
      {/* three friends, hands in */}
      <g fill="#1F1530">
        <circle cx="70" cy="560" r="22" /><rect x="44" y="580" width="52" height="90" rx="22" />
        <circle cx="250" cy="560" r="22" /><rect x="224" y="580" width="52" height="90" rx="22" />
        <circle cx="160" cy="590" r="24" /><rect x="132" y="612" width="56" height="70" rx="22" />
      </g>
    </svg>
  )
}

export function PinBadge() {
  return (
    <svg viewBox="0 0 120 120" className="ph-pin" aria-hidden="true">
      <defs>
        <linearGradient id="pin-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB84D" />
          <stop offset="0.5" stopColor="#FF7352" />
          <stop offset="1" stopColor="#E8497F" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="#15161A" />
      <circle cx="60" cy="60" r="47" fill="url(#pin-g)" />
      <path d="M60 24l9 36-9 36-9-36z" fill="#15161A" />
      <path d="M24 60l36-8 36 8-36 8z" fill="#FFF4EA" opacity="0.9" />
      <circle cx="60" cy="60" r="6" fill="#FFF4EA" />
    </svg>
  )
}

export default function Phone() {
  const { time, date } = useClock()

  return (
    <div className="phone">
      <div className="ph-body">
        {Array.from({ length: EDGE_SLICES }).map((_, i) => (
          <i key={i} className="ph-slice" style={{ transform: `translateZ(${-(i + 1) * 1.4}px)` }} />
        ))}

        {/* back of the phone: frosted glass, camera, logo */}
        <div className="ph-back">
          <div className="ph-cams">
            <span /><span /><span />
            <b />
          </div>
          <div className="ph-back-logo"><Logo size={64} /></div>
        </div>

        {/* front */}
        <div className="ph-front">
          <div className="ph-screen">
            {/* app: the map with a quest, then the party lobby */}
            <div className="scr scr-app">
              <MapArt />
              <StatusBar time={time} />
              <div className="app-top">
                <span className="app-chip">Quests nearby</span>
                <span className="app-level">Lv 1</span>
              </div>
              <div className="you-dot"><span /></div>
              <div className="quest-pin"><Logo size={22} /></div>
              <div className="sheet">
                <div className="sheet-grab" />
                <div className="sheet-quest">
                  <span className="q-tag">Party of 2 to 4</span>
                  <strong>The Human Compass</strong>
                  <p>Each player picks a detail at the fountain. Together, make one photo.</p>
                  <div className="q-meta"><span>0.1 mi away</span><span className="q-xp">+150 XP</span></div>
                </div>
                <div className="lobby">
                  <div className="lobby-row"><span className="lobby-title">Party</span><span className="lobby-count"><b className="lobby-n">1</b> of 4</span></div>
                  <div className="slots">
                    <div className="slot filled"><span className="av" style={{ background: '#15161A' }}>Y</span>You</div>
                    <div className="slot join join-1"><span className="av" style={{ background: '#FF7352' }}>R</span>Rowan</div>
                    <div className="slot join join-2"><span className="av" style={{ background: '#6C5BD4' }}>M</span>Mika</div>
                    <div className="slot open">Open</div>
                  </div>
                </div>
                <div className="sheet-btn">
                  <span className="sb sb-join">Join party</span>
                  <span className="sb sb-start">Start quest</span>
                </div>
              </div>
            </div>

            {/* camera: proof photo */}
            <div className="scr scr-cam">
              <CameraScene />
              <div className="cam-ui">
                <div className="cam-hint">Fit all three finds in one shot</div>
                <div className="cam-frame"><i /><i /><i /><i /></div>
                <div className="cam-bar">
                  <span className="cam-thumb" />
                  <span className="cam-shutter"><b /></span>
                  <span className="cam-flip" />
                </div>
              </div>
              <div className="cam-flash" />
            </div>

            {/* rewards */}
            <div className="scr scr-reward">
              <StatusBar time={time} />
              <div className="rw-inner">
                <span className="rw-label">Quest complete</span>
                <div className="rw-xp">+<span className="rw-num">0</span> XP</div>
                <div className="rw-level">
                  <div className="rw-level-row"><span className="rw-lv">Level 1</span><span className="rw-lv-next">Level 2</span></div>
                  <div className="rw-bar"><i className="rw-fill" /></div>
                </div>
                <div className="rw-pin">
                  <PinBadge />
                  <div><small>New pin</small><strong>True North</strong></div>
                </div>
                <div className="rw-friends">
                  <span className="av" style={{ background: '#FF7352' }}>R</span>
                  <span className="av" style={{ background: '#6C5BD4' }}>M</span>
                  <p>Rowan and Mika added as friends</p>
                </div>
              </div>
              <div className="rw-drops">{Array.from({ length: 16 }).map((_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%` }} />)}</div>
            </div>

            {/* lock screen sits above the app and slides away to unlock */}
            <div className="scr scr-lock">
              <StatusBar time={time} />
              <div className="lock-clock">
                <span className="lock-date">{date}</span>
                <span className="lock-time">{time}</span>
              </div>
              <div className="notif">
                <span className="notif-icon"><Logo size={22} /></span>
                <div className="notif-body">
                  <div className="notif-head"><strong>MeltMode</strong><span>now</span></div>
                  <p>A quest just popped up 0.1 mi away. 2 of 4 spots still open.</p>
                </div>
              </div>
              <div className="lock-swipe">Swipe up to open</div>
              <div className="lock-finger" />
            </div>

            {/* screen off */}
            <div className="scr scr-off" />
            <div className="ph-sheen" />
            <div className="ph-island" />
            <div className="ph-homebar" />
          </div>
        </div>
      </div>
    </div>
  )
}
