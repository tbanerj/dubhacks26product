import { useEffect, useState } from 'react'
import './Demo.css'

/* ---------- Demo content (edit the words here) ---------- */
type QuestId = 'lens' | 'worlds' | 'compass'
type Mode = 'solo' | 'party'

type Quest = {
  id: QuestId
  title: string
  tag: string
  tagClass: string
  place: string
  text: string
  task: string
  xp: number
  pinName: string
  canSolo: boolean
}

const QUESTS: Quest[] = [
  {
    id: 'lens',
    title: 'The Local Lens',
    tag: 'Solo',
    tagClass: 'tag-solo',
    place: 'A public landmark',
    text: 'Find a detail most people walk right past.',
    task: 'Take a creative photo of one overlooked detail.',
    xp: 100,
    pinName: 'Sharp Eye',
    canSolo: true,
  },
  {
    id: 'worlds',
    title: 'Two Different Worlds',
    tag: 'Social',
    tagClass: 'tag-social',
    place: 'A busy public square',
    text: 'Swap one favourite local spot with another player.',
    task: 'Snap a photo of a place you would recommend to a visitor.',
    xp: 150,
    pinName: 'Good Neighbour',
    canSolo: true,
  },
  {
    id: 'compass',
    title: 'The Human Compass',
    tag: 'Party · 2–4',
    tagClass: 'tag-party',
    place: 'A park or plaza',
    text: 'Everyone picks a detail. Together, make one photo.',
    task: 'Create one group photo inspired by everyone’s finds.',
    xp: 150,
    pinName: 'True North',
    canSolo: false,
  },
]

// Fictional demo players, clearly labeled as such
const DEMO_PLAYERS = [
  { name: 'Rowan', color: '#F4D06F', ink: '#18352D' },
  { name: 'Mika', color: '#245C46', ink: '#F8F8F3' },
]

const PHOTOS = [
  { id: 0, label: 'Archway detail' },
  { id: 1, label: 'Fountain at noon' },
  { id: 2, label: 'Leaf on a bench' },
]

const STEP_NAMES = ['Discover', 'Team up', 'Complete', 'Rewards']
const START_XP = 410
const XP_PER_LEVEL = 500
const CONFETTI_COLORS = ['#F4D06F', '#245C46', '#DDECD0', '#18352D', '#F8F8F3']

/* ---------- Illustrations ---------- */
function PhotoArt({ id }: { id: number }) {
  if (id === 0) {
    return (
      <svg viewBox="0 0 120 90" aria-hidden="true">
        <rect width="120" height="90" fill="#18352D" />
        <circle cx="96" cy="20" r="10" fill="#F4D06F" />
        <path d="M30 90V45a30 30 0 0 1 60 0v45z" fill="#6B7771" />
        <path d="M44 90V48a16 16 0 0 1 32 0v42z" fill="#DDECD0" />
      </svg>
    )
  }
  if (id === 1) {
    return (
      <svg viewBox="0 0 120 90" aria-hidden="true">
        <rect width="120" height="90" fill="#F8F8F3" />
        <ellipse cx="60" cy="72" rx="44" ry="12" fill="#245C46" />
        <rect x="52" y="34" width="16" height="38" rx="4" fill="#18352D" />
        <path d="M60 34c-14-4-22 6-26 16M60 34c14-4 22 6 26 16" stroke="#DDECD0" strokeWidth="3" fill="none" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 90" aria-hidden="true">
      <rect width="120" height="90" fill="#DDECD0" />
      <rect x="10" y="58" width="100" height="10" rx="4" fill="#18352D" />
      <rect x="20" y="68" width="8" height="18" fill="#18352D" />
      <rect x="92" y="68" width="8" height="18" fill="#18352D" />
      <path d="M50 56c0-18 14-28 30-28 0 18-12 28-30 28z" fill="#F4D06F" />
    </svg>
  )
}

function PinArt({ id }: { id: QuestId }) {
  return (
    <svg viewBox="0 0 120 120" className="pin-art" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="#18352D" />
      <circle cx="60" cy="60" r="48" fill="#F4D06F" />
      {id === 'lens' && (
        <>
          <circle cx="60" cy="60" r="24" fill="#18352D" />
          <circle cx="60" cy="60" r="13" fill="#DDECD0" />
          <circle cx="54" cy="54" r="4" fill="#FFFFFF" />
        </>
      )}
      {id === 'worlds' && (
        <>
          <circle cx="50" cy="60" r="20" fill="#245C46" />
          <circle cx="70" cy="60" r="20" fill="#6B7771" opacity="0.9" />
        </>
      )}
      {id === 'compass' && (
        <>
          <path d="M60 26l9 34-9 34-9-34z" fill="#18352D" />
          <path d="M26 60l34-9 34 9-34 9z" fill="#245C46" />
          <circle cx="60" cy="60" r="6" fill="#FFFFFF" />
        </>
      )}
    </svg>
  )
}

/* ---------- The demo ---------- */
export default function Demo() {
  const [step, setStep] = useState(0)
  const [questId, setQuestId] = useState<QuestId | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [photo, setPhoto] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)

  const quest = QUESTS.find((q) => q.id === questId)

  // Pretend to check the photo for a moment, then show rewards
  useEffect(() => {
    if (!checking) return
    const timer = setTimeout(() => {
      setChecking(false)
      setStep(3)
    }, 1400)
    return () => clearTimeout(timer)
  }, [checking])

  function pickQuest(id: QuestId) {
    const picked = QUESTS.find((q) => q.id === id)
    setQuestId(id)
    setMode(picked && !picked.canSolo ? 'party' : null)
    setStep(1)
  }

  function restart() {
    setStep(0)
    setQuestId(null)
    setMode(null)
    setPhoto(null)
    setChecking(false)
  }

  const endXp = START_XP + (quest ? quest.xp : 0)
  const leveledUp = endXp >= XP_PER_LEVEL
  const levelProgress = ((endXp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100

  return (
    <section className="container demo-page">
      {/* Left: explanation and progress */}
      <div className="demo-intro">
        <span className="pill">Interactive demo</span>
        <h1>Play a quest in 30 seconds</h1>
        <p className="demo-lead">
          Get a feel for Thaw without downloading anything. Pick a quest, team up, and see what you earn.
        </p>

        <ol className="stepper">
          {STEP_NAMES.map((name, i) => (
            <li
              key={name}
              className={i === step ? 'current' : i < step ? 'done' : ''}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="stepper-dot">{i < step ? '✓' : i + 1}</span>
              {name}
            </li>
          ))}
        </ol>

        <p className="demo-note">
          This is a simulated preview. Players are fictional, and nothing is uploaded or saved.
        </p>
      </div>

      {/* Right: the playable card */}
      <div className="demo-card">
        {/* Step 1: Discover */}
        {step === 0 && (
          <div className="demo-step" key="discover">
            <p className="demo-kicker">
              <span className="live-dot"></span>New quests popped up nearby
            </p>
            <h2>Which one looks fun?</h2>
            <div className="quest-options">
              {QUESTS.map((q) => (
                <button key={q.id} className="quest-option" onClick={() => pickQuest(q.id)}>
                  <span className={'quest-tag ' + q.tagClass}>{q.tag}</span>
                  <strong>{q.title}</strong>
                  <span className="option-text">{q.text}</span>
                  <span className="option-xp">+{q.xp} XP</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Team up */}
        {step === 1 && quest && (
          <div className="demo-step" key="team">
            <p className="demo-kicker">{quest.place}</p>
            <h2>{quest.title}</h2>
            <p className="muted">How do you want to play?</p>

            <div className="mode-options">
              <button
                className={'mode-option' + (mode === 'solo' ? ' selected' : '')}
                onClick={() => setMode('solo')}
                disabled={!quest.canSolo}
                aria-pressed={mode === 'solo'}
              >
                <strong>Go solo</strong>
                <span>{quest.canSolo ? 'Play at your own pace' : 'This one needs a party'}</span>
              </button>
              <button
                className={'mode-option' + (mode === 'party' ? ' selected' : '')}
                onClick={() => setMode('party')}
                aria-pressed={mode === 'party'}
              >
                <strong>Team up</strong>
                <span>Join a party of 2–4</span>
              </button>
            </div>

            {mode === 'party' && (
              <div className="lobby">
                <div className="lobby-head">
                  <strong>Party lobby</strong>
                  <span>3 of 4 spots filled</span>
                </div>
                <div className="lobby-player">
                  <span className="avatar" style={{ background: '#18352D' }}>Y</span>
                  You <span className="ready">Ready</span>
                </div>
                {DEMO_PLAYERS.map((p, i) => (
                  <div className="lobby-player joining" key={p.name} style={{ animationDelay: `${0.4 + i * 0.5}s` }}>
                    <span className="avatar" style={{ background: p.color, color: p.ink }}>{p.name[0]}</span>
                    {p.name} <em>demo player</em>
                    <span className="ready">Ready</span>
                  </div>
                ))}
                <div className="lobby-player empty">One spot open</div>
              </div>
            )}

            {mode === 'solo' && (
              <p className="solo-note">
                Solo quests count just as much. You can always team up next time.
              </p>
            )}

            <div className="demo-actions">
              <button className="btn btn-light" onClick={restart}>Back</button>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={mode === null}>
                Start quest
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 2 && quest && (
          <div className="demo-step" key="complete">
            <p className="demo-kicker">Your task</p>
            <h2>{quest.task}</h2>
            <p className="muted">In the app you’d take a real photo. Here, pick one of ours:</p>

            <div className="photo-options">
              {PHOTOS.map((p) => (
                <button
                  key={p.id}
                  className={'photo-option' + (photo === p.id ? ' selected' : '')}
                  onClick={() => setPhoto(p.id)}
                  aria-pressed={photo === p.id}
                >
                  <PhotoArt id={p.id} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            {checking ? (
              <div className="checking" role="status">
                <span className="spinner"></span>
                Checking your photo… (simulated)
              </div>
            ) : (
              <div className="demo-actions">
                <button className="btn btn-light" onClick={() => setStep(1)}>Back</button>
                <button className="btn btn-dark" onClick={() => setChecking(true)} disabled={photo === null}>
                  Submit photo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Rewards */}
        {step === 3 && quest && (
          <div className="demo-step rewards" key="rewards">
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `${(i % 6) * 0.12}s`,
                    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  }}
                ></span>
              ))}
            </div>

            <p className="demo-kicker success">Quest complete!</p>
            <div className="xp-earned">+{quest.xp} XP</div>

            <div className="level-box">
              <div className="level-row">
                <strong>{leveledUp ? 'Level up! You’re now Level 2' : 'Level 1'}</strong>
                <span>{endXp % XP_PER_LEVEL} / {XP_PER_LEVEL} XP</span>
              </div>
              <div className="level-bar">
                <div className="level-fill" style={{ width: `${levelProgress}%` }}></div>
              </div>
            </div>

            <div className="pin-unlock">
              <PinArt id={quest.id} />
              <div>
                <span className="pin-label">New collectible pin</span>
                <strong>{quest.pinName}</strong>
              </div>
            </div>

            <div className="demo-actions">
              <button className="btn btn-light" onClick={restart}>Play another</button>
              <a className="btn btn-primary" href="#/download">Get the app</a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}