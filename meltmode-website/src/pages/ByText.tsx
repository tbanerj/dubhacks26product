import { useState } from 'react'
import type { FormEvent } from 'react'
import './ByText.css'

/* ---------------------------------------------------------------
   Paste your partner's sign-up web address here when it's ready,
   e.g. 'https://your-backend.com/api/text-signup'
   While it's empty (''), the form shows "Coming soon".
   Never put a Photon API key in this file: website code is public.
---------------------------------------------------------------- */
const SIGNUP_ENDPOINT = ''

// CONFIRM with your partner: does text play work like these steps?
const STEPS = [
  { title: 'Sign up', text: 'Enter your phone number below. No app, no account, no storage needed.' },
  { title: 'Get quests by text', text: 'We’ll text you fun quests to try at public places around you.' },
  { title: 'Reply to play', text: 'Answer our texts to join a quest, check in, and keep your progress going.' },
]

type Status = 'idle' | 'sending' | 'done' | 'error'

export default function ByText() {
  const [phone, setPhone] = useState('')
  const [isAdult, setIsAdult] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const isLive = SIGNUP_ENDPOINT !== ''
  const formLocked = !isLive || status === 'sending'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 15) {
      setStatus('error')
      setMessage('Please enter a full phone number, including the area code.')
      return
    }
    if (!isAdult) {
      setStatus('error')
      setMessage('MeltMode is only for people 18 and older. Please confirm your age to sign up.')
      return
    }
    if (!agreed) {
      setStatus('error')
      setMessage('Please tick the box to agree to receive texts.')
      return
    }

    setStatus('sending')
    try {
      // CONFIRM with your partner: what information his server expects
      const response = await fetch(SIGNUP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), ageConfirmed: true, consent: true }),
      })
      if (!response.ok) throw new Error('Sign-up failed')
      setStatus('done')
      setMessage('You’re signed up! Watch for your first text from MeltMode.')
      setPhone('')
      setIsAdult(false)
      setAgreed(false)
    } catch {
      setStatus('error')
      setMessage('Something went wrong and you weren’t signed up. Please try again in a moment.')
    }
  }

  return (
    <section className="container text-page">
      <div className="text-intro">
        <span className="pill">Get it by text</span>
        <h1>No room for another app? Play by text.</h1>
        <p className="text-lead">
          Not everyone has the storage, data, or patience for one more app. With MeltMode by text, quests
          come to you as text messages instead.
        </p>

        <ol className="text-steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="text-step-num">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="text-side">
        {/* A little illustrated text conversation */}
        <div className="chat" aria-hidden="true">
          <div className="bubble them">New quest nearby: The Local Lens. Find a detail most people walk past. Reply JOIN to play.</div>
          <div className="bubble me">JOIN</div>
          <div className="bubble them">You’re in! Send a photo of your find when you’re ready. +100 XP waiting.</div>
        </div>

        <form className="signup" onSubmit={handleSubmit} noValidate>
          <h2>Sign up for texts</h2>

          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(206) 555-0123"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={formLocked}
          />

          <label className="consent">
            <input
              type="checkbox"
              checked={isAdult}
              onChange={(e) => setIsAdult(e.target.checked)}
              disabled={formLocked}
            />
            <span>I’m 18 or older.</span>
          </label>

          <label className="consent">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={formLocked}
            />
            <span>
              I agree to receive text messages from MeltMode. Message frequency varies. Message and data
              rates may apply. Reply STOP to opt out. See our{' '}            
                <a href="#/privacy">privacy policy</a>.
            </span>
          </label>

          {isLive ? (
            <button className="btn btn-primary" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Signing you up…' : 'Text me quests'}
            </button>
          ) : (
            <button className="btn coming-soon-btn" type="button" disabled>
              Coming soon
            </button>
          )}

          {!isLive && (
            <p className="form-note">
              Text sign-up isn’t open yet. In the meantime, <a href="#/demo">try the demo</a>.
            </p>
          )}

          {message && (
            <p className={'form-message ' + status} role="status">
              {message}
            </p>
          )}
        </form>
      </div>
    </section>
  )
}