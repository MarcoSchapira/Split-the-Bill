import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  confirmDeleteAccount,
  sendDeleteAccountCode,
  verifyDeleteAccountCode,
} from '../api/authApi'
import { apiErrorMessage, AUTH_UNAUTHORIZED_EVENT } from '../api/client'
import { clearAuth } from '../auth/authStorage'

const RESEND_COOLDOWN_SECONDS = 60
const DELETE_ACCOUNT_ERROR_ID = 'delete-account-form-error'
const DELETE_ACCOUNT_INFO_ID = 'delete-account-form-info'

const SENT_MESSAGE =
  'If a BillCompass account exists for this email address, a verification code has been sent.'

type Step = 'email' | 'code' | 'confirm' | 'done'

export function DeleteAccountPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [deletionToken, setDeletionToken] = useState('')
  const [hasAcknowledged, setHasAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const previousStepRef = useRef(step)

  useEffect(() => {
    if (previousStepRef.current === step) return
    previousStepRef.current = step
    stepHeadingRef.current?.focus()
  }, [step])

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
      await sendDeleteAccountCode(email.trim())
      setStep('code')
      setInfo(SENT_MESSAGE)
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
      await sendDeleteAccountCode(email.trim())
      setInfo(SENT_MESSAGE)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to resend verification code.'))
    } finally {
      setIsSendingCode(false)
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code from your email.')
      return
    }

    setIsSubmitting(true)

    try {
      const token = await verifyDeleteAccountCode(email.trim(), code)
      setDeletionToken(token)
      setInfo(null)
      setStep('confirm')
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to verify the code.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!hasAcknowledged) {
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await confirmDeleteAccount(deletionToken)
      // If this browser had an active session for the deleted account, drop it.
      clearAuth()
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
      setStep('done')
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to delete your account.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCancel() {
    setStep('email')
    setCode('')
    setDeletionToken('')
    setHasAcknowledged(false)
    setError(null)
    setInfo(null)
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <p className="eyebrow">BillCompass</p>
        <h1>Delete your BillCompass account</h1>
        <p>
          This page lets you permanently delete your account without the app
          installed. Read our <Link to="/privacy">Privacy Policy</Link> for
          details on what is deleted and what is retained.
        </p>
      </section>
      <section className="auth-card">
        {step === 'email' ? (
          <>
            <p className="eyebrow">Account deletion</p>
            <h2 ref={stepHeadingRef} tabIndex={-1}>Delete your BillCompass account</h2>
            <form
              aria-describedby={error ? DELETE_ACCOUNT_ERROR_ID : undefined}
              className="stack-form"
              onSubmit={handleSendCode}
            >
              <p className="delete-account-copy">
                Enter the email address associated with your BillCompass account.
                We will send you a verification code to confirm your identity.
              </p>
              <label>
                Email
                <input
                  autoComplete="email"
                  aria-describedby={error ? DELETE_ACCOUNT_ERROR_ID : undefined}
                  aria-invalid={Boolean(error)}
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {error ? <p className="form-error" id={DELETE_ACCOUNT_ERROR_ID} role="alert">{error}</p> : null}
              <button className="primary-button" disabled={isSendingCode} type="submit">
                {isSendingCode ? 'Sending code...' : 'Send verification code'}
              </button>
            </form>
          </>
        ) : null}

        {step === 'code' ? (
          <>
            <p className="eyebrow">Account deletion</p>
            <h2 ref={stepHeadingRef} tabIndex={-1}>Enter your verification code</h2>
            <form className="stack-form" onSubmit={handleVerifyCode}>
              {info ? <p aria-live="polite" className="form-info" id={DELETE_ACCOUNT_INFO_ID} role="status">{info}</p> : null}
              <label>
                Verification code
                <input
                  autoComplete="one-time-code"
                  aria-describedby={[
                    info ? DELETE_ACCOUNT_INFO_ID : null,
                    error ? DELETE_ACCOUNT_ERROR_ID : null,
                  ].filter(Boolean).join(' ') || undefined}
                  aria-invalid={Boolean(error)}
                  className="verification-code-input"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  type="text"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
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
                <button className="text-button" type="button" onClick={handleCancel}>
                  Change email
                </button>
              </div>
              {error ? <p className="form-error" id={DELETE_ACCOUNT_ERROR_ID} role="alert">{error}</p> : null}
              <button className="primary-button" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Verifying...' : 'Continue'}
              </button>
            </form>
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <p className="eyebrow">Account deletion</p>
            <h2 ref={stepHeadingRef} tabIndex={-1}>Permanently delete your account?</h2>
            <div className="delete-account-summary">
              <p className="delete-account-copy">Deleting your account will:</p>
              <ul>
                <li>Permanently disable your account and sign you out on all devices.</li>
                <li>Delete solo bills, friendships, invitations and group memberships.</li>
                <li>Remove your email address and display name.</li>
                <li>
                  Retain shared bills needed by other participants, but replace your
                  identity with &ldquo;Deleted Account.&rdquo;
                </li>
                <li>
                  Retain limited logs or backup copies temporarily as described in the{' '}
                  <Link to="/privacy">Privacy Policy</Link>.
                </li>
              </ul>
              <p className="delete-account-warning">Account deletion cannot be undone.</p>
              <label className="delete-account-checkbox">
                <input
                  checked={hasAcknowledged}
                  type="checkbox"
                  onChange={(event) => setHasAcknowledged(event.target.checked)}
                />
                I understand that deleting my account is permanent.
              </label>
              {error ? <p className="form-error" id={DELETE_ACCOUNT_ERROR_ID} role="alert">{error}</p> : null}
              <div className="delete-account-actions">
                <button className="secondary-button" type="button" onClick={handleCancel}>
                  Cancel
                </button>
                <button
                  className="danger-button"
                  disabled={!hasAcknowledged || isSubmitting}
                  type="button"
                  onClick={() => {
                    void handleConfirmDelete()
                  }}
                >
                  {isSubmitting ? 'Deleting account...' : 'Permanently delete account'}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <p className="eyebrow">Account deletion</p>
            <h2 ref={stepHeadingRef} tabIndex={-1}>Your BillCompass account has been deleted</h2>
            <p className="delete-account-copy">
              Your account can no longer be accessed. Certain de-identified shared
              records and temporary backups may remain as described in the{' '}
              <Link to="/privacy">Privacy Policy</Link>.
            </p>
            <p className="delete-account-copy">
              A confirmation email has been sent to your email address.
            </p>
            <p className="auth-link">
              <Link to="/">Return to the BillCompass homepage</Link>
            </p>
          </>
        ) : null}

        {step !== 'done' ? (
          <p className="auth-link">
            No longer have access to your email? Contact{' '}
            <a href="mailto:privacy@split-the-bill.net">privacy@split-the-bill.net</a>.
          </p>
        ) : null}
      </section>
    </main>
  )
}
