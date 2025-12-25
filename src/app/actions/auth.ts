'use server'

import { createClient, createAdminClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

export async function signUp(formData: {
  email: string
  password: string
  role: 'business' | 'freelancer'
  full_name?: string
  organization_name?: string
  country?: string
  default_currency?: string
  organization_type?: string
}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        role: formData.role,
        full_name: formData.full_name
      },
      emailRedirectTo: `${(await headers()).get('origin')}/auth/callback`
    }
  })

  if (authError) {
    return { error: authError.message }
  }

  if (user) {
    // Insert into profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: user.id,
          role: formData.role,
          full_name: formData.full_name,
          organization_name: formData.organization_name,
          country: formData.country,
          default_currency: formData.default_currency,
          organization_type: formData.organization_type,
          updated_at: new Date().toISOString(),
        }
      ])
    
    if (profileError) {
      console.error('Error creating profile:', profileError)
      // We don't necessarily want to fail the whole signup if profile creation fails,
      // but we should log it. In a production app, we might want more robust handling.
    }
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

export async function updateProfile(formData: {
  full_name?: string
  organization?: string
  country?: string
  default_currency?: string
  organization_type?: string
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        full_name: formData.full_name,
        organization: formData.organization,
      }
    })

    if (authError) {
      return { error: authError.message }
    }

    // Also update the profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        organization_name: formData.organization,
        country: formData.country,
        default_currency: formData.default_currency,
        organization_type: formData.organization_type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (profileError) {
      return { error: profileError.message }
    }

    return { success: true }
  } catch (err: any) {
    return { error: err.message || "An unexpected error occurred during update." }
  }
}
