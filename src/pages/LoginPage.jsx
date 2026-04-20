import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../supabaseClient'
import './LoginPage.css'

export function LoginPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (error) {
      setError('')
    }
  }, [email, password])

  if (user) {
    return <Navigate to="/chats" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message || 'Invalid email or password')
      setIsLoading(false)
      return
    }

    navigate('/chats', { replace: true })
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Login form">
        <div className="login-card__header">
          <h1 className="login-card__title">ArhamChat</h1>
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

          <label className="login-field">
            <span>Password</span>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="login-error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}

          <button className="login-button" type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <p className="auth-helper">
          <Link className="auth-switch__link" to="/forgot-password">
            Forgot your password?
          </Link>
        </p>

        <p className="auth-switch">
          Need an account?{' '}
          <Link className="auth-switch__link" to="/signup">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  )
}
