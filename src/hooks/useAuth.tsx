'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

type UserRole = 'business' | 'freelancer' | null

interface AuthContextType {
  user: User | null
  role: UserRole
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)
  
  // Use useMemo to prevent creating a new client every render
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!supabase) {
      console.warn("Auth: Supabase client not initialized. Check your environment variables.")
      setLoading(false)
      return
    }

    const fetchProfileWithRetry = async (userId: string, retries = 3): Promise<UserRole | null> => {
      for (let i = 0; i < retries; i++) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle()
          
          if (profile) {
            console.log(`useAuth: Profile found on attempt ${i + 1}:`, profile.role)
            return profile.role
          }
          
          if (i < retries - 1) {
            console.log(`useAuth: Profile not found, retrying... (${i + 1}/${retries})`)
            await new Promise(resolve => setTimeout(resolve, 1500)) // Wait 1.5s
          }
        } catch (err) {
          console.error("useAuth: Profile fetch error:", err)
        }
      }
      return null
    }

    const fetchUser = async () => {
      try {
        setLoading(true)
        console.log("useAuth: Initializing session...")
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          const roleResult = await fetchProfileWithRetry(user.id)
          setRole(roleResult)
        }
      } catch (err) {
        console.error("useAuth: Initial fetch error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        console.log("useAuth: Event:", event, "User:", session?.user?.id)
        const currentUser = session?.user ?? null
        setUser(currentUser)
        
        if (currentUser) {
          // If we already have a role, don't necessarily re-fetch unless it's a forced change
          // But for robustness during signup/confirmation, let's fetch
          const roleResult = await fetchProfileWithRetry(currentUser.id)
          setRole(roleResult)
        } else {
          setRole(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
