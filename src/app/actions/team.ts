'use server'

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { sendOnboardingEmail } from "./notifications"

export async function getTeamMembers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('organization_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function getTeamProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from('profiles')
    .select('organization_name, full_name')
    .eq('id', user.id)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function addTeamMember(member: {
  name: string
  role?: string
  email?: string
  wallet_address: string
  btc_address?: string
  rate?: string
  payment_frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  type: 'employee' | 'contractor'
  contract_start?: string
  contract_end?: string
  contract_duration?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  // Validate email if provided
  if (member.email) {
    // Check if email is already registered as a user account
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', member.email)
      .maybeSingle()
    
    if (existingProfile) {
      return { error: "This email is already registered as a user account. Please use a different email." }
    }

    // Check if email already exists in team members for this organization
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('organization_id', user.id)
      .eq('email', member.email)
      .maybeSingle()
    
    if (existingMember) {
      return { error: "A recipient with this email already exists in your organization." }
    }
  }

  const { error } = await supabase
    .from('team_members')
    .insert([{
      ...member,
      organization_id: user.id,
      status: 'Active'
    }])

  if (error) return { error: error.message }
  
  // Trigger email notification
  if (member.email) {
    await sendOnboardingEmail({
      name: member.name,
      email: member.email,
      rate: member.rate || "Not specified",
      frequency: member.payment_frequency,
      startDate: member.contract_start
    })
  }
  
  revalidatePath('/dashboard/recipients')
  return { success: true }
}

export async function updateTeamMember(id: string, updates: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  // Validate email if it's being updated
  if (updates.email) {
    // Check if email is already registered as a user account
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', updates.email)
      .maybeSingle()
    
    if (existingProfile) {
      return { error: "This email is already registered as a user account. Please use a different email." }
    }

    // Check if email already exists in another team member for this organization
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('organization_id', user.id)
      .eq('email', updates.email)
      .neq('id', id) // Exclude the current member being updated
      .maybeSingle()
    
    if (existingMember) {
      return { error: "A recipient with this email already exists in your organization." }
    }
  }

  const { error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/recipients')
  return { success: true }
}

export async function deleteTeamMember(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id)
    .eq('organization_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/recipients')
  return { success: true }
}

export async function recordPayout(id: string, txId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const updates: any = { last_payout_at: new Date().toISOString() }
  if (txId) updates.last_tx_id = txId

  const { error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/payroll/scheduled')
  return { success: true }
}
