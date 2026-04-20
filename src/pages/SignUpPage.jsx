import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../supabaseClient'
import './LoginPage.css'

export function SignUpPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
  }, [email, password, confirmPassword])

  if (user) {
    return <Navigate to="/chats" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message || 'Unable to create your account right now.')
      setIsLoading(false)
      return
    }

    if (data.session) {
      navigate('/chats', { replace: true })
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(
        'Direct sign up is blocked because email confirmation is still enabled in Supabase. Disable Confirm email in Supabase Auth settings to use normal sign up.',
      )
      setIsLoading(false)
      return
    }

    setSuccess('Account created successfully.')
    navigate('/chats', { replace: true })
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Sign up form">
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
              placeholder="Create a password"
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
              placeholder="Confirm your password"
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
                Creating account...
              </>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link className="auth-switch__link" to="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  )
}
