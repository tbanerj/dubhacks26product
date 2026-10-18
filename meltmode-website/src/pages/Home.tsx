import { useLayoutEffect, useRef } from 'react'
import Phone, { PinBadge } from '../components/Phone'
import { scene } from '../lib/frost'
import { gsap, ScrollTrigger, reducedMotion } from '../lib/smooth'
import './Home.css'

/* ---------- Page content (edit the words here) ---------- */

// One caption per beat of the phone story, in order
const CAPTIONS = [
  { title: 'A quest pops up nearby.', text: 'Short challenges at real public places: a fountain, a plaza, the library steps.' },
  { title: 'Everyone close by gets the same one.', text: 'Play solo or join a party of up to four. Talking to anyone is always your choice.' },
  { title: 'Your party fills up.', text: 'Rowan and Mika are two blocks away, and just as new to this as you are.' },
  { title: 'Prove it with one photo.', text: 'Each of you finds a detail, then you fit all three into a single shot. That’s the check-in.' },
  { title: 'Earn the pin. Keep the people.', text: 'XP, levels, streaks and collectible pins for every place you show up.' },
]

const QUESTS = [
  { tag: 'Solo', title: 'The Local Lens', text: 'Find a detail at a landmark that most people walk right past, and take a photo of it.', xp: 100 },
  { tag: 'Social', title: 'Two Different Worlds', text: 'If someone’s up for it, swap one favourite spot you’d send a visitor to.', xp: 150 },
  { tag: 'Party of 2 to 4', title: 'The Human Compass', text: 'Everyone picks a detail. Then the group makes one photo out of all of them.', xp: 150 },
]

const SAFETY = [
  { title: 'Public places only', text: 'Quests happen in open, public spots. Never anywhere isolated or private.', icon: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z' },
  { title: 'Always opt-in', text: 'Talking to people is never required. Every social quest has a solo version.', icon: 'M7 11V6a2 2 0 0 1 4 0v4M11 10V4a2 2 0 0 1 4 0v6M15 10V6a2 2 0 0 1 4 0v8a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L3 14a2 2 0 0 1 3.4-2L7 13' },
  { title: 'Leave whenever', text: 'Step out of a party or a quest at any point. Nobody gets notified why.', icon: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10' },
  { title: 'Your location stays yours', text: 'Other players never see exactly where you are, only that you’re nearby.', icon: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z' },
]

const CHAT = [
  { from: 'them', text: 'New quest 0.2 mi away: The Local Lens. Find a detail most people walk past. Reply JOIN to play.' },
  { from: 'me', text: 'JOIN' },
  { from: 'them', text: 'You’re in. Send a photo of your find whenever you’re ready. +100 XP waiting.' },
  { from: 'me', text: '📷 Photo' },
  { from: 'them', text: 'Nice eye. +100 XP and the Sharp Eye pin. Two other players did this one today.' },
]

const STORY =
  'Seattle has a name for it: the Seattle Freeze. People here are friendly, but turning a polite hello into a real friendship is hard. Most of us want to meet people. We just need a reason to start talking. MeltMode is that reason. When you’re both on the same quest, you already have something in common.'

const FAQS = [
  { q: 'Do I have to talk to strangers?', a: 'No. Solo quests are always there, and social quests only match you with players who also chose to join. You can leave a party at any time.' },
  { q: 'Where can I play?', a: 'We’re starting around the University of Washington in Seattle. Quests are built around real public places, so MeltMode can grow to other cities too.' },
  { q: 'When can I get it?', a: 'MeltMode is coming soon to iPhone and Android. Until then, you can play a quest in your browser.' },
  { q: 'Is it free?', a: 'Yes. MeltMode is free to play.' },
  { q: 'No space for another app?', a: 'Play by text instead. Quests come to you as messages, and you reply to play.' },
]

function Icon({ d }: { d: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

// mix two rgb colors; the page repaints between frozen night and thawed paper
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`
const DARK_BG = [0, 0, 0]
const LIGHT_BG = [244, 243, 241]
const DARK_FG = [242, 244, 248]
const LIGHT_FG = [21, 22, 26]

export default function Home() {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const html = document.documentElement
    const q = gsap.utils.selector(root)
    const phoneEl = q('.phone')[0] as HTMLElement
    const fitEl = q('.phone-fit')[0] as HTMLElement

    // fit the 320x660 phone to the viewport
    const fit = () => {
      const mobile = innerWidth < 900
      const s = Math.min(1, (innerHeight * (mobile ? 0.54 : 0.8)) / 660, (innerWidth * 0.8) / 320)
      fitEl.style.setProperty('--s', String(s))
    }
    fit()
    addEventListener('resize', fit)

    const paint = (lit: number) => {
      scene.lit = lit
      html.style.setProperty('--bg', mix(DARK_BG, LIGHT_BG, lit))
      html.style.setProperty('--fg', mix(DARK_FG, LIGHT_FG, lit))
    }

    // which tone the header should use, from whatever section is under it
    let storyActive = true
    let ctaActive = false
    const setTone = (tone: string) => (html.dataset.tone = tone)
    const updateActive = () => (scene.active = storyActive || ctaActive)

    // the melt spreads from wherever the phone is
    const followPhone = () => {
      if (!storyActive) return
      const r = phoneEl.getBoundingClientRect()
      scene.origin = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }
    }
    gsap.ticker.add(followPhone)

    scene.melt = 0
    paint(0)
    setTone('dark')

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      // ===== The phone story =====
      const melt = { v: 0 }
      const lit = { v: 0 }
      const xp = { v: 0 }
      const joined = { v: 1 }

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onUpdate: () => {
          scene.melt = melt.v
          paint(lit.v)
          if (storyActive) setTone(lit.v > 0.5 ? 'light' : 'dark')
          ;(q('.rw-num')[0] as HTMLElement).textContent = String(Math.round(xp.v))
          ;(q('.lobby-n')[0] as HTMLElement).textContent = String(Math.round(joined.v))
        },
      })

      gsap.set(q('.caption'), { autoAlpha: 0, y: 40 })
      gsap.set(phoneEl, { rotationY: 180, rotationX: 18, rotationZ: -10, y: '62vh', scale: 1.15 })
      gsap.set(q('.notif'), { autoAlpha: 0, y: -30, scale: 0.94 })
      gsap.set(q('.ph-status'), { autoAlpha: 0 })
      gsap.set([q('.scr-cam'), q('.scr-reward')], { autoAlpha: 0 })
      gsap.set(q('.join'), { autoAlpha: 0, scale: 0.6 })
      gsap.set(q('.rw-pin'), { autoAlpha: 0, scale: 0.6, rotation: -8 })
      gsap.set(q('.rw-friends'), { autoAlpha: 0, y: 12 })
      gsap.set(q('.ph-route'), { strokeDashoffset: 300, strokeDasharray: '2 7' })

      // 1. the phone turns over from its back and rises; the headline clears out
      tl.to(q('.hero-copy'), { y: '-35vh', autoAlpha: 0, duration: 1, ease: 'power2.in' }, 0)
        .to(q('.scroll-cue'), { autoAlpha: 0, duration: 0.3 }, 0)
        .to(phoneEl, { rotationY: 0, rotationX: 0, rotationZ: 0, y: 0, scale: 1, duration: 1.7, ease: 'power3.inOut' }, 0)
        .fromTo(q('.ph-sheen'), { '--sheen': '-70%' }, { '--sheen': '70%', duration: 2.2, ease: 'none' }, 0)

      // desktop: slide the phone right to make room for captions
      mm.add('(min-width: 900px)', () => {
        tl.to(q('.phone-wrap'), { x: '17vw', duration: 1, ease: 'power2.inOut' }, 1.1)
      })

      // 2. the screen wakes with a notification
      tl.to(q('.scr-off'), { autoAlpha: 0, duration: 0.25, ease: 'none' }, 1.55)
        .to(q('.scr-lock .ph-status'), { autoAlpha: 1, duration: 0.2 }, 1.6)
        .to(q('.notif'), { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.6)' }, 1.85)
        .to(q('.caption-0'), { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 1.9)

      // 3. swipe up: the lock screen lifts and the freeze breaks
      tl.to(q('.lock-finger'), { autoAlpha: 1, scale: 1, duration: 0.15 }, 2.75)
        .to(q('.caption-0'), { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, 2.8)
        .to(q('.lock-finger'), { y: -420, autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, 2.95)
        .to(q('.scr-lock'), { yPercent: -100, duration: 0.5, ease: 'power3.inOut' }, 3.0)
        .to(q('.ph-homebar'), { autoAlpha: 1, duration: 0.2 }, 3.3)
        .to(q('.scr-app .ph-status'), { autoAlpha: 1, duration: 0.2 }, 3.2)
        .to(melt, { v: 1, duration: 1.5, ease: 'power1.inOut' }, 3.0)
        .to(lit, { v: 1, duration: 0.8, ease: 'sine.inOut' }, 3.2)
        .to(q('.caption-1'), { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 4.0)
        .to(q('.ph-route'), { strokeDashoffset: 0, duration: 0.9, ease: 'none' }, 4.0)

      // 4. join the party: the lobby opens and two players arrive
      tl.to(q('.caption-1'), { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, 5.0)
        .to(q('.lobby'), { height: 'auto', duration: 0.45, ease: 'power3.inOut' }, 5.1)
        .to(q('.sheet-quest p'), { height: 0, autoAlpha: 0, duration: 0.35 }, 5.1)
        .to(q('.caption-2'), { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 5.35)
        .to(q('.join-1'), { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, 5.7)
        .to(joined, { v: 2, duration: 0.01 }, 5.75)
        .to(q('.join-2'), { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, 6.15)
        .to(joined, { v: 3, duration: 0.01 }, 6.2)
        .to(q('.sb-start'), { autoAlpha: 1, duration: 0.25 }, 6.5)

      // 5. snap the proof photo
      tl.to(q('.caption-2'), { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, 6.9)
        .fromTo(q('.scr-cam'), { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power2.out' }, 7.0)
        .to(q('.caption-3'), { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 7.2)
        .fromTo(q('.cam-frame'), { scale: 1.12, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'power3.out' }, 7.35)
        .to(q('.cam-shutter'), { scale: 0.86, duration: 0.08, yoyo: true, repeat: 1 }, 7.85)
        .to(q('.cam-flash'), { autoAlpha: 1, duration: 0.06, ease: 'none' }, 7.9)
        .to(q('.cam-flash'), { autoAlpha: 0, duration: 0.35, ease: 'power1.out' }, 7.96)

      // 6. rewards
      tl.to(q('.caption-3'), { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, 8.2)
        .to(q('.scr-reward'), { autoAlpha: 1, duration: 0.3 }, 8.3)
        .to(q('.caption-4'), { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 8.5)
        .to(xp, { v: 150, duration: 0.6, ease: 'power2.out' }, 8.5)
        .fromTo(q('.rw-fill'), { width: '82%' }, { width: '100%', duration: 0.5, ease: 'power2.out' }, 8.6)
        .to(q('.rw-pin'), { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(1.8)' }, 8.9)
        .to(q('.rw-friends'), { autoAlpha: 1, y: 0, duration: 0.3 }, 9.2)
        .fromTo(
          q('.rw-drops i'),
          { y: 0, autoAlpha: 1, rotation: 0 },
          { y: 720, autoAlpha: 0, rotation: () => gsap.utils.random(-90, 90), duration: 0.9, ease: 'power1.in', stagger: { each: 0.03, from: 'random' } },
          8.6
        )
        .to({}, { duration: 0.6 }, 9.6) // a beat to read before the page moves on

      // progress line
      tl.fromTo(q('.story-progress i'), { scaleY: 0 }, { scaleY: 1, duration: tl.duration(), ease: 'none' }, 0)

      if (reducedMotion) {
        // no long scrubbed ride: show where the story lands
        tl.progress(1)
        gsap.set(q('.hero-copy'), { autoAlpha: 1, y: 0 })
        gsap.set(q('.caption'), { autoAlpha: 0 })
        q('.story')[0].classList.add('story-static')
      } else {
        ScrollTrigger.create({
          trigger: q('.story-stage')[0],
          start: 'top top',
          end: () => '+=' + innerHeight * 7,
          pin: true,
          scrub: 0.8,
          animation: tl,
          onLeave: () => { storyActive = false; updateActive() },
          onEnterBack: () => { storyActive = true; updateActive(); setTone(lit.v > 0.5 ? 'light' : 'dark') },
        })
      }

      // ===== Header tone for the sections after the story =====
      q('[data-tone]').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 38px',
          end: 'bottom 38px',
          onToggle: (self) => self.isActive && setTone((el as HTMLElement).dataset.tone!),
        })
      })

      // ===== Text chat: bubbles arrive one by one =====
      if (!reducedMotion) {
        const bubbles = q('.sms-bubble')
        gsap.set(bubbles, { autoAlpha: 0, y: 18, scale: 0.92 })
        ScrollTrigger.create({
          trigger: q('.sms')[0],
          start: 'top 70%',
          once: true,
          onEnter: () => {
            const t = gsap.timeline()
            bubbles.forEach((b, i) => {
              const mine = b.classList.contains('me')
              b.style.transformOrigin = mine ? '100% 100%' : '0% 100%'
              t.to(b, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }, i * 0.7)
            })
          },
        })
      }

      // ===== Story paragraph: words light up as you read =====
      if (!reducedMotion) {
        gsap.fromTo(
          q('.story-text .w'),
          { opacity: 0.14 },
          {
            opacity: 1,
            stagger: 0.04,
            ease: 'none',
            scrollTrigger: { trigger: q('.story-text')[0], start: 'top 75%', end: 'bottom 45%', scrub: true },
          }
        )
      }

      // ===== The end: the page freezes over again =====
      ScrollTrigger.create({
        trigger: q('.cta')[0],
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          ctaActive = self.isActive
          updateActive()
        },
      })
      const freeze = { v: 1 }
      gsap.to(freeze, {
        v: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: q('.cta')[0],
          start: 'top 90%',
          end: 'top 10%',
          scrub: true,
          onUpdate: () => {
            if (storyActive) return
            scene.origin = { x: 0.5, y: 0.5 }
            scene.melt = freeze.v
            scene.lit = freeze.v
          },
        },
      })
    }, root)

    requestAnimationFrame(() => ScrollTrigger.refresh())

    return () => {
      ctx.revert()
      gsap.ticker.remove(followPhone)
      removeEventListener('resize', fit)
    }
  }, [])

  return (
    <div ref={root}>
      {/* ===== 1. The story: one pinned stage, scrubbed by scroll ===== */}
      <section className="story">
        <div className="story-stage">
          <div className="hero-copy">
            <p className="hero-origin">Started at the University of Washington</p>
            <h1>Make friends the way games taught you&nbsp;to.</h1>
            <p className="hero-lead">
              MeltMode drops real-world quests around Seattle. Show up, team up, and you already have something to talk about.
            </p>
          </div>

          <div className="captions">
            {CAPTIONS.map((c, i) => (
              <div className={'caption caption-' + i} key={c.title}>
                <h2>{c.title}</h2>
                <p>{c.text}</p>
                {i === CAPTIONS.length - 1 && (
                  <div className="caption-actions">
                    <a className="btn btn-primary" href="#/demo">Play a quest now</a>
                    <a className="btn btn-ghost" href="#/download">Get the app</a>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="phone-wrap">
            <div className="phone-fit">
              <Phone />
            </div>
          </div>

          <div className="story-progress" aria-hidden="true"><i /></div>
          <div className="scroll-cue" aria-hidden="true"><span />Scroll to thaw</div>
        </div>
      </section>

      {/* ===== 2. Play by text ===== */}
      <section className="sec sec-text" data-tone="light">
        <div className="container text-grid">
          <div className="text-copy">
            <h2>No room for another app? Play by&nbsp;text.</h2>
            <p>
              Quests arrive as messages. Reply to join, send a photo to finish. No download, no account, and we never see
              your GPS location.
            </p>
            <a className="btn btn-ink" href="#/text">Get quests by text</a>
          </div>
          <div className="sms" aria-label="An example text conversation with MeltMode">
            <div className="sms-head">
              <span className="sms-avatar"><svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6c9.5 13 15.5 20.5 15.5 30a15.5 15.5 0 0 1-31 0C16.5 26.5 22.5 19 32 6z" fill="#fff" /></svg></span>
              <strong>MeltMode</strong>
              <small>Text message</small>
            </div>
            {CHAT.map((m, i) => (
              <div key={i} className={'sms-bubble ' + m.from}>{m.text}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 3. Quests ===== */}
      <section className="sec sec-quests" data-tone="light">
        <div className="container">
          <div className="sec-head">
            <h2>Small quests. Real places.</h2>
            <p>A few you might find around campus this week.</p>
          </div>
          <ul className="quest-list">
            {QUESTS.map((quest) => (
              <li key={quest.title} className="quest-row">
                <span className="quest-tag">{quest.tag}</span>
                <h3>{quest.title}</h3>
                <p>{quest.text}</p>
                <span className="quest-xp">+{quest.xp} XP</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== 4. Safety ===== */}
      <section className="sec sec-safety" data-tone="light">
        <div className="container safety-grid">
          <div className="safety-head">
            <h2>Built for comfort, not&nbsp;pressure.</h2>
            <div className="safety-pin"><PinBadge /></div>
          </div>
          <div className="safety-list">
            {SAFETY.map((s) => (
              <div className="safety-item" key={s.title}>
                <Icon d={s.icon} />
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 5. Why we built it ===== */}
      <section className="sec sec-story" data-tone="light">
        <div className="container">
          <p className="story-text">
            {STORY.split(' ').map((word, i) => (
              <span className="w" key={i}>{word} </span>
            ))}
          </p>
          <p className="story-sign">Ryan, Thanika and Trinav, students at UW</p>
        </div>
      </section>

      {/* ===== 6. FAQ ===== */}
      <section className="sec sec-faq" data-tone="light">
        <div className="container faq-grid">
          <h2>Questions you might have</h2>
          <div className="faq">
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 7. The end: frozen again, your move ===== */}
      <section className="cta" data-tone="dark">
        <div className="container cta-inner">
          <h2>Ready to melt the freeze?</h2>
          <p>Play a quest in your browser now. The app is coming soon to iPhone and Android.</p>
          <div className="cta-actions">
            <a className="btn btn-melt" href="#/demo">Play a quest</a>
            <a className="btn btn-ghost" href="#/download">Get the app</a>
          </div>
          <p className="cta-hint">Move your cursor to thaw the glass.</p>
        </div>
      </section>
    </div>
  )
}
