import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { AuthBrandLink } from '../components/AuthBrandLink'

const LOGIN_ERROR_ID = 'login-form-error'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await auth.login({ email, password })
      const destination =
        (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to sign in.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <AuthBrandLink />
      <section className="brand-panel">
        <h1>Shared expenses, clear balances.</h1>
        <p>
          Keep shared expenses organized and settle together with an account built on
          your own secure ledger.
        </p>
      </section>
      <section className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h2>Log in</h2>
        <form
          aria-describedby={error ? LOGIN_ERROR_ID : undefined}
          className="stack-form"
          onSubmit={handleSubmit}
        >
          <label>
            Email
            <input
              autoComplete="email"
              aria-describedby={error ? LOGIN_ERROR_ID : undefined}
              aria-invalid={Boolean(error)}
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              aria-describedby={error ? LOGIN_ERROR_ID : undefined}
              aria-invalid={Boolean(error)}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="form-error" id={LOGIN_ERROR_ID} role="alert">{error}</p> : null}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in...' : 'Log in'}
          </button>
        </form>
        <p className="auth-link">
          New to BillCompass? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  )
}
