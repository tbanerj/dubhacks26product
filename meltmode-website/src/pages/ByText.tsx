import { useState } from 'react'
import type { FormEvent } from 'react'
import './ByText.css'

type SignupState = 'idle' | 'sending' | 'error'
const GENERIC_ERROR = 'We couldn’t reach the signup service. Your number was not registered. Check your connection and try again.'

const ERROR_MESSAGES: Record<string, string> = {
  age_confirmation_required: 'Please confirm that you’re 18 or older to continue.',
  consent_required: 'Please agree to the phone-number and messaging terms to continue.',
  invalid_request: 'Enter a valid phone number, including your area code.',
  rate_limited: 'Too many signup attempts from this connection. Please wait a few minutes and try again.',
  signup_unavailable: 'Signup is temporarily unavailable. Your number was not registered. Please try again later.',
  origin_not_allowed: 'This website is not authorized to create signups. Please contact the MeltMode team.',
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
    } catch {
      setError(GENERIC_ERROR)
      setState('error')
    }
  }

  if (assignedPhoneNumber) {
    const displayNumber = formatPhoneNumber(assignedPhoneNumber)
    return (
      <section className="container text-page">
        <div className="text-card" aria-live="polite">
          <span className="pill">Your text line is ready</span>
          <h1>One tap to start.</h1>
          <p className="text-lead">Use this MeltMode number to start your iMessage conversation.</p>
          <a
            className="btn btn-primary sms-link"
            href={`sms:${assignedPhoneNumber}`}
            aria-label={`Text MeltMode at ${displayNumber}`}
          >
            Text {displayNumber}
          </a>
          <p className="text-footnote">We haven’t sent you a message. Tapping the button opens a new text to MeltMode.</p>
          <button className="text-reset" type="button" onClick={() => {
            setAssignedPhoneNumber(null)
            setPhone('')
            setAgeConfirmed(false)
            setConsent(false)
            setState('idle')
          }}>
            Use a different number
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="container text-page">
      <div className="text-card">
        <span className="pill">Get it by text</span>
        <h1>Take MeltMode with you.</h1>
        <p className="text-lead">
          Enter your mobile number and we’ll set up your text line. Then tap once to open a message to MeltMode.
        </p>

        <form className="text-signup" onSubmit={handleSubmit} aria-busy={state === 'sending'}>
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
          <p id="phone-hint" className="text-footnote">US numbers can be entered with or without +1. Your number is sent securely to Photon to set up your shared text line.</p>

          <label className="text-consent">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(event) => setAgeConfirmed(event.target.checked)}
              required
              disabled={state === 'sending'}
            />
            <span>I confirm that I’m 18 or older.</span>
          </label>
          <label className="text-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
              disabled={state === 'sending'}
            />
            <span>
              I agree that MeltMode will send my number to Photon (Spectrum Cloud) to set up my text line.
              Signup does not send a text; I’ll start the conversation myself. After I text MeltMode, I agree
              to receive service messages. Message frequency varies; message and data rates may apply. I can
              opt out by texting STOP. See our <a href="#/privacy">privacy policy</a>.
            </span>
          </label>

          <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? 'Setting up your text line…' : 'Set up text line'}
          </button>
          <p className="form-message error" role="alert" hidden={state !== 'error'}>{error}</p>
        </form>
      </div>
    </section>
  )
}
