import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({
  user: null,
  loading: true,
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function ensureProfile(currentUser) {
      if (!currentUser?.id) {
        return
      }

      try {
        const { error } = await supabase.from('profiles').upsert(
          {
            id: currentUser.id,
            email: currentUser.email,
          },
          {
            onConflict: 'id',
          },
        )

        if (error) {
          console.error('Profile sync failed:', error.message)
        }
      } catch (error) {
        console.error('Profile sync failed:', error)
      }
    }

    async function bootstrapSession() {
      try {
        const { data } = await supabase.auth.getSession()
        const currentUser = data.session?.user ?? null

        if (!mounted) {
          return
        }

        setUser(currentUser)
        setLoading(false)
        void ensureProfile(currentUser)
      } catch (error) {
        console.error('Initial session check failed:', error)

        if (!mounted) {
          return
        }

        setUser(null)
        setLoading(false)
      }
    }

    bootstrapSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null

      if (!mounted) {
        return
      }

      setUser(currentUser)
      setLoading(false)
      void ensureProfile(currentUser)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({ user, loading }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
