import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './LoginPage.css'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (mounted) {
        setHasRecoverySession(Boolean(data.session))
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return
      }

      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasRecoverySession(Boolean(session))
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (error) {
      setError('')
    }

    if (success) {
      setSuccess('')
    }
  }, [password, confirmPassword])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message || 'Unable to update your password right now.')
      setIsLoading(false)
      return
    }

    setSuccess('Your password has been updated. Redirecting to login...')
    setIsLoading(false)

    window.setTimeout(() => {
      navigate('/login', { replace: true })
    }, 1200)
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Reset password form">
        <div className="login-card__header">
          <p className="login-card__eyebrow">Reset password</p>
          <h1 className="login-card__title">ArhamChat</h1>
          <p className="login-card__subtitle">
            Create a new password to secure your account.
          </p>
        </div>

        {!hasRecoverySession ? (
          <>
            <p className="login-error">
              Open this page from your password reset email to continue.
            </p>
            <p className="auth-switch">
              Need a new email?{' '}
              <Link className="auth-switch__link" to="/forgot-password">
                Request another reset link
              </Link>
            </p>
          </>
        ) : (
          <>
            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-field">
                <span>New Password</span>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a new password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>

              <label className="login-field">
                <span>Confirm Password</span>
                <input
                  className="login-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  minLength={6}
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
                    Updating password...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>

            <p className="auth-switch">
              Back to{' '}
              <Link className="auth-switch__link" to="/login">
                Log in
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  )
}
