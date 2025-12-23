'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'business' | 'freelancer'>('business')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: role,
        }
      }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (authData.user) {
      // Update the profile role (the trigger handles creation, we update role)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', authData.user.id)

      if (profileError) {
        setError(profileError.message)
      } else {
        router.push('/dashboard')
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground">
      <div className="w-full max-w-md p-8 border rounded-2xl shadow-xl bg-card">
        <h1 className="text-3xl font-bold mb-2 text-center">Create your account</h1>
        <p className="text-muted-foreground text-center mb-8 text-sm">Join Payrail to manage STX payroll.</p>
        
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border bg-input"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg border bg-input"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div className="pt-2">
            <span className="block text-sm font-medium mb-2">I am a:</span>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('business')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                  role === 'business' ? 'border-orange-600 bg-orange-50 ring-1 ring-orange-600' : 'hover:bg-accent'
                }`}
              >
                <span className="font-bold text-sm">Business</span>
                <span className="text-[10px] text-muted-foreground">Paying freelancers</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('freelancer')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                  role === 'freelancer' ? 'border-orange-600 bg-orange-50 ring-1 ring-orange-600' : 'hover:bg-accent'
                }`}
              >
                <span className="font-bold text-sm">Freelancer</span>
                <span className="text-[10px] text-muted-foreground">Receiving payments</span>
              </button>
            </div>
          </div>

          {error && <p className="text-red-600 text-xs mt-2 text-center font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <a href="/login" className="text-orange-600 hover:underline">Log in</a>
        </p>
      </div>
    </div>
  )
}
