import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sendRegistrationCode } from '../api/authApi'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/useAuth'

const RESEND_COOLDOWN_SECONDS = 60

export function RegisterPage() {
  const [step, setStep] = useState<'email' | 'details'>('email')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (resendCooldown <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => current - 1)
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [resendCooldown])

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setIsSendingCode(true)

    try {
      await sendRegistrationCode(email.trim())
      setStep('details')
      setInfo(`Verification code sent to ${email.trim().toLowerCase()}.`)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to send verification code.'))
    } finally {
      setIsSendingCode(false)
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0) {
      return
    }

    setError(null)
    setInfo(null)
    setIsSendingCode(true)

    try {
      await sendRegistrationCode(email.trim())
      setInfo(`A new verification code was sent to ${email.trim().toLowerCase()}.`)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to resend verification code.'))
    } finally {
      setIsSendingCode(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code from your email.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      await auth.register({
        email: email.trim(),
        code,
        password,
        ...(name.trim() ? { name: name.trim() } : {}),
      })
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to create your account.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <p className="eyebrow">EquiSplit</p>
        <h1>Start a fair tab.</h1>
        <p>
          Invite registered friends and keep every shared cost
          connected to your account.
        </p>
      </section>
      <section className="auth-card">
        <p className="eyebrow">Get started</p>
        <h2>Create account</h2>
        <div aria-label="Registration progress" className="register-steps">
          <span className={step === 'email' ? 'register-step is-active' : 'register-step is-complete'}>
            1. Verify email
          </span>
          <span className={step === 'details' ? 'register-step is-active' : 'register-step'}>
            2. Account details
          </span>
        </div>

        {step === 'email' ? (
          <form className="stack-form" onSubmit={handleSendCode}>
            <label>
              Email
              <input
                autoComplete="email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" disabled={isSendingCode} type="submit">
              {isSendingCode ? 'Sending code...' : 'Send verification code'}
            </button>
          </form>
        ) : (
          <form className="stack-form" onSubmit={handleSubmit}>
            <p className="form-info">{info}</p>
            <label>
              Verification code
              <input
                autoComplete="one-time-code"
                className="verification-code-input"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                required
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <div className="register-resend-row">
              <button
                className="text-button"
                disabled={isSendingCode || resendCooldown > 0}
                type="button"
                onClick={() => {
                  void handleResendCode()
                }}
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : isSendingCode
                    ? 'Sending...'
                    : 'Resend code'}
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                  setInfo(null)
                }}
              >
                Change email
              </button>
            </div>
            <label>
              Name <span className="optional">optional</span>
              <input
                autoComplete="name"
                maxLength={100}
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                autoComplete="new-password"
                minLength={8}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Confirm password
              <input
                autoComplete="new-password"
                minLength={8}
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}
        <p className="auth-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  )
}
