import './Home.css'

/* ---------- Small reusable icon ---------- */
const ICONS = {
  compass: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM15.5 8.5l-2 5-5 2 2-5z',
  people: 'M9 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 7a2.5 2.5 0 1 1 0 5M16 14.5c3 0 5 2 5 5',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM5 5h3M16 5h3M5 5a3 3 0 0 0 3 4M19 5a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4v4',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 11a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  chat: 'M4 5h16v11H9l-5 4z',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
  hand: 'M7 11V6a2 2 0 0 1 4 0v4M11 10V4a2 2 0 0 1 4 0v6M15 10V6a2 2 0 0 1 4 0v8a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L3 14a2 2 0 0 1 3.4-2L7 13',
  exit: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
}

type IconName = keyof typeof ICONS

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

/* ---------- Page content (edit the words here) ---------- */
const STEPS = [
  {
    title: 'Discover a quest',
    text: 'Quests pop up around you: spot a hidden detail at a landmark, swap a local favourite, or build a group photo.',
    icon: 'compass' as IconName,
  },
  {
    title: 'Team up or go solo',
    text: 'Join a party of up to four players, or pick a solo quest. Social quests are always your choice.',
    icon: 'people' as IconName,
  },
  {
    title: 'Complete and collect',
    text: 'Snap a photo as proof, earn XP, unlock a collectible pin, and watch your progress grow.',
    icon: 'camera' as IconName,
  },
]

const FEATURES = [
  {
    title: 'Real-world quests',
    text: 'Short, playful challenges tied to real places, from parks and plazas to libraries and public art.',
    icon: 'pin' as IconName,
  },
  {
    title: 'Social adventures',
    text: 'Form a party, chat with your group, and give everyone the same easy reason to say hello.',
    icon: 'chat' as IconName,
  },
  {
    title: 'Levels and streaks',
    text: 'Earn XP for every quest, level up, keep your streak alive, and see where you rank.',
    icon: 'trophy' as IconName,
  },
  {
    title: 'Collectible pins',
    text: 'Unlock illustrated pins for places you explore: souvenirs of where you went and who you met.',
    icon: 'compass' as IconName,
  },
]

const QUESTS = [
  {
    tag: 'Solo',
    tagClass: 'tag-solo',
    title: 'The Local Lens',
    text: 'Visit a public landmark and take a creative photo of a detail most people walk right past.',
  },
  {
    tag: 'Social',
    tagClass: 'tag-social',
    title: 'Two Different Worlds',
    text: 'If someone is up for it, swap one favourite local spot you’d recommend to a visitor.',
  },
  {
    tag: 'Party · 2–4 players',
    tagClass: 'tag-party',
    title: 'The Human Compass',
    text: 'Each player picks a detail at a landmark, then the group creates one photo inspired by everyone’s finds.',
  },
]

const SAFETY = [
  { title: 'Public places only', text: 'Quests happen in open, public spots. Never isolated or private places.', icon: 'shield' as IconName },
  { title: 'Always opt-in', text: 'Talking to others is never required. Every social quest has a solo option.', icon: 'hand' as IconName },
  { title: 'Leave anytime', text: 'Step away from a party or quest whenever you want. No pressure.', icon: 'exit' as IconName },
  { title: 'Your location stays yours', text: 'Other players never see exactly where you are.', icon: 'eye' as IconName },
]

const FAQS = [
  {
    q: 'Do I have to talk to strangers?',
    a: 'No. Solo quests are always available, and social quests only happen with players who have also chosen to join. You can leave a party at any time.',
  },
  {
    q: 'Where can I play?',
    a: 'We’re starting around the University of Washington in Seattle. Quests are designed around real public places, so MeltMode can grow to other cities too.',
  },
  {
    q: 'When can I get it?',
    a: 'MeltMode is coming soon to iPhone and Android. Until then, you can try the demo right here in your browser.',
  },
  {
    q: 'Is MeltMode free?',
    a: 'Yes, MeltMode is free to play right now.',
  },
  {
    q: 'I don’t have space for another app. Can I still play?',
    a: 'Yes, we’re working on a text-message version so you can get quests without downloading anything.',
  },
]

/* ---------- The phone illustration in the hero ---------- */
function PhoneArt() {
  return (
    <div className="phone-art" aria-hidden="true">
      <div className="float-chip chip-xp">+150 XP</div>
      <div className="float-chip chip-pin">
        <span className="pin-badge">
          <Icon name="pin" size={16} />
        </span>
        New pin unlocked
      </div>
      <div className="float-chip chip-party">Party ready · 3/4</div>

      <div className="phone">
        <div className="phone-notch"></div>
        <div className="phone-screen">
          <div className="notify">
            <span className="notify-dot"></span>
            A new quest just popped up nearby
          </div>

          <div className="quest-card">
            <span className="quest-tag tag-party">Party · 2–4 players</span>
            <h3>The Human Compass</h3>
            <p>Each player picks a detail. Together, make one photo.</p>
            <div className="quest-meta">
              <div className="avatars">
                <span style={{ background: '#F4D06F' }}></span>
                <span style={{ background: '#245C46' }}></span>
                <span style={{ background: '#6B7771' }}></span>
                <span className="avatar-open">+1</span>
              </div>
              <strong>+150 XP</strong>
            </div>
            <div className="fake-btn">Join party</div>
          </div>

          <div className="mini-cards">
            <div className="mini-card">
              <span className="mini-icon gold">
                <Icon name="camera" size={18} />
              </span>
              The Local Lens
            </div>
            <div className="mini-card">
              <span className="mini-icon terracotta">
                <Icon name="chat" size={18} />
              </span>
              Two Different Worlds
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- The page ---------- */
export default function Home() {
  return (
    <>
      {/* 1. Hero */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-text">
            <span className="pill">Coming soon to iPhone and Android</span>
            <h1>
              Explore your city. <span className="highlight">Meet your people.</span>
            </h1>
            <p className="hero-lead">
              MeltMode turns the places around you into quests. Discover a challenge nearby, team up with
              other players, and earn XP and collectible pins for showing up in real life.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#/demo">
                Try the demo
              </a>
              <a className="btn btn-light" href="#/download">
                Get the app
              </a>
            </div>
            <p className="hero-note">
              No room for another app? <a href="#/text">Play by text</a>
            </p>
          </div>
          <PhoneArt />
        </div>
      </section>

      {/* 2. How it works */}
      <section className="section" id="how">
        <div className="container">
          <div className="section-head">
            <span className="pill">How it works</span>
            <h2>Three steps from your couch to a new friend</h2>
          </div>
          <div className="steps">
            {STEPS.map((step, i) => (
              <div className="step" key={step.title}>
                <div className="step-top">
                  <span className="step-num">{i + 1}</span>
                  <span className="step-icon">
                    <Icon name={step.icon} />
                  </span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Features */}
      <section className="section section-sand">
        <div className="container">
          <div className="section-head">
            <span className="pill">Features</span>
            <h2>Everything you love about a game, in the real world</h2>
          </div>
          <div className="features">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <span className="feature-icon">
                  <Icon name={f.icon} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Example quests */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="pill">Quests you might find</span>
            <h2>Small adventures, big conversations</h2>
          </div>
          <div className="quests">
            {QUESTS.map((q) => (
              <div className="quest" key={q.title}>
                <span className={'quest-tag ' + q.tagClass}>{q.tag}</span>
                <h3>{q.title}</h3>
                <p>{q.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Safety */}
      <section className="section safety">
        <div className="container">
          <div className="section-head">
            <span className="pill pill-on-dark">Meet safely</span>
            <h2>Built for comfort, not pressure</h2>
          </div>
          <div className="safety-grid">
            {SAFETY.map((s) => (
              <div className="safety-item" key={s.title}>
                <span className="safety-icon">
                  <Icon name={s.icon} />
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    {/* 6. Why we built it */}
      <section className="section">
        <div className="container story">
          <span className="pill">Why we built it</span>
          <h2>Seattle has a name for it: the Seattle Freeze.</h2>
          <p>
            {"People here are friendly, but turning a polite hello into a real friendship can feel hard. Most of us want to meet new people. We just don't have a good reason to start talking."}
          </p>
          <p>
            {"MeltMode gives everyone that reason. When you're both on the same quest, you already have something in common and something to talk about. We're a team of students building the app we wished we had."}
          </p>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="section section-sand">
        <div className="container faq-wrap">
          <div className="section-head">
            <span className="pill">FAQ</span>
            <h2>Questions you might have</h2>
          </div>
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

      {/* 8. Final call to action */}
      <section className="section">
        <div className="container">
          <div className="cta-band">
            <h2>Ready to melt the freeze?</h2>
            <p>Try MeltMode in your browser now, and be first to know when the app launches.</p>
            <div className="hero-actions">
              <a className="btn btn-dark" href="#/demo">
                Try the demo
              </a>
              <a className="btn btn-light" href="#/download">
                Get the app
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}