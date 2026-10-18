import { useState } from 'react'
import type { FormEvent } from 'react'
import './ByText.css'

const STEPS = [
  { title: 'Sign up', text: 'Enter your phone number below. No app, no account, no storage needed.' },
  { title: 'Get your text line', text: 'We set up a Thaw number for you. Signup does not send you a text.' },
  { title: 'Text us to play', text: 'Tap once to open a message to Thaw, then reply to join quests and keep your progress going.' },
]

type SignupState = 'idle' | 'sending' | 'error'
const GENERIC_ERROR = 'We couldn’t reach the signup service. Your number was not registered. Check your connection and try again.'

const ERROR_MESSAGES: Record<string, string> = {
  age_confirmation_required: 'Please confirm that you’re 18 or older to continue.',
  consent_required: 'Please agree to the phone-number and messaging terms to continue.',
  invalid_request: 'Enter a valid phone number, including your area code.',
  rate_limited: 'Too many signup attempts from this connection. Please wait a few minutes and try again.',
  signup_unavailable: 'Signup is temporarily unavailable. Your number was not registered. Please try again later.',
  origin_not_allowed: 'This website is not authorized to create signups. Please contact the Thaw team.',
}

function formatPhoneNumber(phone: string): string {
  const usNumber = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return usNumber ? `+1 (${usNumber[1]}) ${usNumber[2]}-${usNumber[3]}` : phone
}

export default function ByText() {
  const [phone, setPhone] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<SignupState>('idle')
  const [error, setError] = useState('')
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null)

  function reset() {
    setAssignedPhoneNumber(null)
    setPhone('')
    setAgeConfirmed(false)
    setConsent(false)
    setError('')
    setState('idle')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setState('sending')

    try {
      const response = await fetch('/api/public/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, ageConfirmed, consent }),
      })
      const result: { assignedPhoneNumber?: unknown; error?: unknown } = await response.json()
      if (!response.ok) {
        const key = typeof result.error === 'string' ? result.error : ''
        setError(ERROR_MESSAGES[key] ?? 'Signup failed. Your number was not registered. Please try again.')
        setState('error')
        return
      }
      if (typeof result.assignedPhoneNumber !== 'string' || !/^\+[1-9]\d{6,14}$/.test(result.assignedPhoneNumber)) {
        setError('Signup could not be confirmed. Your number was not registered. Please try again.')
        setState('error')
        return
      }
      setAssignedPhoneNumber(result.assignedPhoneNumber)
      setState('idle')
    } catch {
      setError(GENERIC_ERROR)
      setState('error')
    }
  }

  const displayNumber = assignedPhoneNumber ? formatPhoneNumber(assignedPhoneNumber) : ''

  return (
    <section className="container text-page">
      <div className="text-intro">
        <span className="pill">Get it by text</span>
        <h1>No room for another app? Play by text.</h1>
        <p className="text-lead">
          Not everyone has the storage, data, or patience for one more app. With Thaw by text, quests
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
        <div className="chat" aria-hidden="true">
          <div className="bubble them">New quest nearby: The Local Lens. Find a detail most people walk past. Reply JOIN to play.</div>
          <div className="bubble me">JOIN</div>
          <div className="bubble them">You’re in! Send a photo of your find when you’re ready. +100 XP waiting.</div>
        </div>

        {assignedPhoneNumber ? (
          <div className="signup" aria-live="polite">
            <span className="pill">Your text line is ready</span>
            <h2>One tap to start.</h2>
            <p className="text-lead">Use this Thaw number to start your iMessage conversation.</p>
            <a
              className="btn btn-primary sms-link"
              href={`sms:${assignedPhoneNumber}`}
              aria-label={`Text Thaw at ${displayNumber}`}
            >
              Text {displayNumber}
            </a>
            <p className="form-note">We haven’t sent you a message. Tapping the button opens a new text to Thaw.</p>
            <button className="text-reset" type="button" onClick={reset}>
              Use a different number
            </button>
          </div>
        ) : (
          <form className="signup" onSubmit={handleSubmit} aria-busy={state === 'sending'}>
            <h2>Set up your text line</h2>

            <label htmlFor="signup-phone">Your phone number</label>
            <input
              id="signup-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+1 (206) 555-0123"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              disabled={state === 'sending'}
              aria-describedby="phone-hint"
            />
            <p id="phone-hint" className="text-footnote">
              US numbers can be entered with or without +1. Your number is sent securely to Photon to set up your shared text line.
            </p>

            <label className="consent">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
                required
                disabled={state === 'sending'}
              />
              <span>I confirm that I’m 18 or older.</span>
            </label>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                required
                disabled={state === 'sending'}
              />
              <span>
                I agree that Thaw will send my number to Photon (Spectrum Cloud) to set up my text line.
                Signup does not send a text; I’ll start the conversation myself. After I text Thaw, I agree
                to receive service messages. Message frequency varies; message and data rates may apply. I can
                opt out by texting STOP. See our <a href="#/privacy">privacy policy</a>.
              </span>
            </label>

            <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Setting up your text line…' : 'Set up text line'}
            </button>
            <p className="form-message error" role="alert" hidden={state !== 'error'}>{error}</p>
          </form>
        )}
      </div>
    </section>
  )
}
