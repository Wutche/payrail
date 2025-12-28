import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error("Supabase environment variables are missing!")
    // Return a dummy client or handle gracefully to prevent hard crash during hydration
    return null as any
  }

  return createBrowserClient(url, key)
}
