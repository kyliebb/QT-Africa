import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { AuthSession } from '../lib/auth'

// undefined = still loading, null = not signed in, AuthSession = signed in
export function useAuth(): AuthSession | null | undefined {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      setSession(user ? { userId: user.id, email: user.email! } : null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      const user = s?.user
      setSession(user ? { userId: user.id, email: user.email! } : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return session
}
