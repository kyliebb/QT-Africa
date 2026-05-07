import { supabase } from './supabase'

export interface AuthSession {
  userId: string
  email: string
}

export const signIn = async (email: string, password: string): Promise<AuthSession> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Sign-in failed')
  return { userId: data.user.id, email: data.user.email! }
}

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
