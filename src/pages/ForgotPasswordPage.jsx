import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './LoginPage.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (error) {
      setError('')
    }

    if (success) {
      setSuccess('')
    }
  }, [email])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setIsLoading(true)

    const redirectTo = `${window.location.origin}/reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (resetError) {
      setError(resetError.message || 'Unable to send a reset email right now.')
      setIsLoading(false)
      return
    }

    setSuccess('Password reset instructions have been sent to your email address.')
    setIsLoading(false)
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Forgot password form">
        <div className="login-card__header">
          <p className="login-card__eyebrow">Password recovery</p>
          <h1 className="login-card__title">ArhamChat</h1>
          <p className="login-card__subtitle">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Email</span>
            <input
              className="login-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          {error ? (
            <p className="login-error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="login-success" role="status" aria-live="polite">
              {success}
            </p>
          ) : null}

          <button className="login-button" type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Sending link...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <p className="auth-switch">
          Back to{' '}
          <Link className="auth-switch__link" to="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  )
}
