'use client'

import * as React from "react"
import Link from "next/link"
import { Wallet, ArrowLeft, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { createClient } from "@/lib/supabase"
import { login } from "@/app/actions/auth"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useNotification } from "@/components/NotificationProvider"

export default function LoginPage() {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const { showNotification } = useNotification()
  const router = useRouter()
  const supabase = createClient()
  return (
    <div className="min-h-[calc(100vh-64px-137px)] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="self-start">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="mb-2">
            <img 
              src="/payrail-logo.svg" 
              alt="Payrail Logo" 
              className="h-24 w-auto object-contain mx-auto"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Log in to your Payrail account</p>
        </div>

        <Card className="shadow-2xl border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-xl text-center">Login</CardTitle>
            <CardDescription className="text-center">Enter your email and password to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault()
              setIsLoading(true)
              
              try {
                const result = await login({ email, password })
                if (result?.error) {
                  showNotification("error", "Login Failed", result.error)
                  setIsLoading(false)
                } else if (result?.success) {
                  showNotification("success", "Welcome Back!", "Redirecting to your dashboard...")
                  router.push('/dashboard')
                }
              } catch (err: any) {
                showNotification("error", "Login Error", "Invalid credentials or server error.")
                setIsLoading(false)
              }
            }}>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input 
                  id="email"
                  type="email" 
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-11 px-4 bg-accent/20"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Button variant="link" size="sm" className="px-0 h-auto text-xs font-semibold">
                    Forgot password?
                  </Button>
                </div>
                <div className="relative">
                  <Input 
                    id="password"
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl h-11 px-4 bg-accent/20 pr-10"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button 
                className="w-full h-12 rounded-xl text-base mt-2 shadow-lg shadow-primary/20"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging In...
                  </>
                ) : (
                  "Log In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link href="/signup" className="text-primary font-bold hover:underline">Sign up</Link>
        </div>
      </div>
    </div>
  )
}
