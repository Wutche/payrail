'use server'

import { createClient, createAdminClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

export async function signUp(formData: {
  email: string
  password: string
  role: 'business' | 'freelancer'
}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        role: formData.role
      },
      emailRedirectTo: `${(await headers()).get('origin')}/auth/callback`
    }
  })

  if (authError) {
    return { error: authError.message }
  }

  return { success: true }
}

export async function login(formData: {
  email: string
  password: string
}) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return { success: true }
}

export async function deleteAccount() {
  let isSuccess = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: "Not authenticated" }
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: "Server Configuration Error: Admin key missing. Please check your .env.local file." }
    }

    const adminClient = await createAdminClient()
    
    // Delete user's profile first
    await supabase.from('profiles').delete().eq('id', user.id)

    // Delete the user from authentication
    const { error } = await adminClient.auth.admin.deleteUser(user.id)

    if (error) {
      return { error: error.message }
    }

    // Sign out the current session
    await supabase.auth.signOut()
    return { success: true }
  } catch (err: any) {
    return { error: err.message || "An unexpected error occurred during deletion." }
  }
}
