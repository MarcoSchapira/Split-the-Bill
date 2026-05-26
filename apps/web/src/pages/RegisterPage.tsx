import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/useAuth'

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

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
        email,
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
          Create groups, invite registered friends, and keep every shared cost
          connected to your account.
        </p>
      </section>
      <section className="auth-card">
        <p className="eyebrow">Get started</p>
        <h2>Create account</h2>
        <form className="stack-form" onSubmit={handleSubmit}>
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
            Email
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
        <p className="auth-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  )
}
