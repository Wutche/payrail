'use server'

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { sendScheduleAddedEmail, sendPaymentSentEmail } from "./notifications"

// Types
export interface PayrollSchedule {
  id: string
  organization_id: string
  name: string
  frequency: 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly'
  pay_day: number
  status: 'draft' | 'ready' | 'processing' | 'paid'
  next_run_at: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface PayrollScheduleItem {
  id: string
  schedule_id: string
  team_member_id: string
  amount: number
  team_member?: {
    id: string
    name: string
    wallet_address: string
    btc_address?: string
  }
}

export interface PayrollRun {
  id: string
  schedule_id: string
  status: 'pending' | 'success' | 'failed'
  tx_id: string | null
  total_amount: number
  executed_at: string
}

// Get all payroll schedules for current user's organization
export async function getPayrollSchedules() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from('payroll_schedules')
    .select(`
      *,
      payroll_schedule_items (
        id,
        amount,
        team_member_id,
        team_members (
          id,
          name,
          email,
          wallet_address,
          btc_address
        )
      )
    `)
    .eq('organization_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

// Get single schedule by ID
export async function getPayrollScheduleById(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from('payroll_schedules')
    .select(`
      *,
      payroll_schedule_items (
        id,
        amount,
        team_member_id,
        team_members (
          id,
          name,
          wallet_address,
          btc_address
        )
      )
    `)
    .eq('id', id)
    .eq('organization_id', user.id)
    .single()

  if (error) return { error: error.message }
  return { data }
}

// Stacks API URL (testnet or mainnet based on environment)
const STACKS_API_URL = process.env.NEXT_PUBLIC_STACKS_NETWORK === 'mainnet' 
  ? 'https://api.hiro.so' 
  : 'https://api.testnet.hiro.so'

/**
 * Verify transaction status on-chain before sending notifications
 * Polls the Stacks API until transaction is confirmed or failed
 * @param txId - Transaction ID to verify
 * @param maxAttempts - Maximum polling attempts (default: 30 = ~5 minutes)
 * @param intervalMs - Polling interval in milliseconds (default: 10000 = 10 seconds)
 * @returns { success: boolean, status: string, error?: string }
 */
export async function verifyTransactionStatus(
  txId: string, 
  maxAttempts: number = 30, 
  intervalMs: number = 10000
): Promise<{ success: boolean; status: string; error?: string }> {
  console.log(`[verifyTransactionStatus] Starting verification for tx: ${txId}`)
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${STACKS_API_URL}/extended/v1/tx/${txId}`)
      
      if (!response.ok) {
        console.log(`[verifyTransactionStatus] Attempt ${attempt}: API returned ${response.status}`)
        // Transaction might not be indexed yet, wait and retry
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs))
          continue
        }
        return { success: false, status: 'unknown', error: 'Transaction not found' }
      }
      
      const data = await response.json()
      const txStatus = data.tx_status
      
      console.log(`[verifyTransactionStatus] Attempt ${attempt}: tx_status = ${txStatus}`)
      
      // Check for final statuses
      if (txStatus === 'success') {
        console.log(`[verifyTransactionStatus] Transaction confirmed successfully!`)
        return { success: true, status: 'success' }
      }
      
      if (txStatus === 'abort_by_response' || txStatus === 'abort_by_post_condition') {
        console.log(`[verifyTransactionStatus] Transaction FAILED: ${txStatus}`)
        const errorMessage = data.tx_result?.repr || 'Transaction failed on-chain'
        return { success: false, status: txStatus, error: errorMessage }
      }
      
      // If still pending, wait and retry
      if (txStatus === 'pending') {
        console.log(`[verifyTransactionStatus] Transaction still pending, waiting...`)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs))
          continue
        }
      }
      
      // Unknown status
      return { success: false, status: txStatus, error: `Unknown status: ${txStatus}` }
      
    } catch (err: any) {
      console.error(`[verifyTransactionStatus] Attempt ${attempt} error:`, err)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
        continue
      }
      return { success: false, status: 'error', error: err.message }
    }
  }
  
  return { success: false, status: 'timeout', error: 'Transaction verification timed out' }
}

// Calculate next run date based on frequency and pay day
function calculateNextRunDate(frequency: 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly', payDay: number): string {
  const now = new Date()
  const next = new Date(now)
  
  if (frequency === 'minutes') {
    // Run every 5 minutes (for testing)
    next.setMinutes(now.getMinutes() + 5)
  } else if (frequency === 'hourly') {
    // Run every hour at the top of the hour
    next.setHours(now.getHours() + 1, 0, 0, 0)
  } else if (frequency === 'daily') {
    // Run every day at 9 AM
    next.setDate(now.getDate() + 1)
    next.setHours(9, 0, 0, 0)
  } else if (frequency === 'weekly') {
    // payDay: 1=Monday, 7=Sunday
    const currentDay = now.getDay() || 7 // Convert Sunday from 0 to 7
    const daysUntil = payDay >= currentDay ? payDay - currentDay : 7 - currentDay + payDay
    next.setDate(now.getDate() + (daysUntil === 0 ? 7 : daysUntil))
    next.setHours(9, 0, 0, 0) // Set to 9 AM
  } else {
    // Monthly: payDay is 1-31
    next.setDate(payDay)
    if (next <= now) {
      next.setMonth(next.getMonth() + 1)
    }
    next.setHours(9, 0, 0, 0) // Set to 9 AM
  }
  
  return next.toISOString()
}

// Create new payroll schedule with items
export async function createPayrollSchedule(data: {
  name: string
  frequency: 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly'
  pay_day: number
  start_date?: string
  end_date?: string
  items: { team_member_id: string; amount: number }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  // For minutes/hourly/daily frequencies, pay_day is not used, default to 0
  const sanitizedPayDay = ['minutes', 'hourly', 'daily'].includes(data.frequency) ? 0 : data.pay_day
  const next_run_at = calculateNextRunDate(data.frequency, sanitizedPayDay)

  // Create schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from('payroll_schedules')
    .insert([{
      organization_id: user.id,
      name: data.name,
      frequency: data.frequency,
      pay_day: sanitizedPayDay,
      status: 'draft',
      next_run_at,
      start_date: data.start_date || null,
      end_date: data.end_date || null
    }])
    .select()
    .single()

  if (scheduleError) return { error: scheduleError.message }

  // Create schedule items
  const items = data.items.map(item => ({
    schedule_id: schedule.id,
    team_member_id: item.team_member_id,
    amount: item.amount
  }))

  const { error: itemsError } = await supabase
    .from('payroll_schedule_items')
    .insert(items)

  if (itemsError) return { error: itemsError.message }

  // Send email notifications to all recipients
  // Get organization name first
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_name')
    .eq('id', user.id)
    .single()
  
  const orgName = profile?.organization_name || 'Your Organization'
  // Use en-GB locale for day/month/year format
  const nextPayDate = new Date(next_run_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  // Get member details and send emails
  for (const item of data.items) {
    const { data: member } = await supabase
      .from('team_members')
      .select('name, email')
      .eq('id', item.team_member_id)
      .single()

    if (member?.email) {
      await sendScheduleAddedEmail({
        name: member.name,
        email: member.email,
        scheduleName: data.name,
        amount: item.amount,
        frequency: data.frequency,
        nextPayDate,
        organizationName: orgName,
      })
    }
  }

  revalidatePath('/dashboard/payroll/scheduled')
  return { success: true, data: schedule }
}

// Update schedule status
export async function updateScheduleStatus(id: string, status: 'draft' | 'ready' | 'processing' | 'paid') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from('payroll_schedules')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/payroll/scheduled')
  return { success: true }
}

// Mark schedule as ready (called when pay date arrives)
export async function markScheduleReady(id: string) {
  return updateScheduleStatus(id, 'ready')
}

// Record a payroll run after execution
export async function recordPayrollRun(data: {
  schedule_id: string
  status: 'pending' | 'success' | 'failed'
  tx_id?: string
  total_amount: number
  recipient_count: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  // Insert run record
  const { error: runError } = await supabase
    .from('payroll_runs')
    .insert([{
      schedule_id: data.schedule_id,
      status: data.status,
      tx_id: data.tx_id || null,
      total_amount: data.total_amount
    }])

  if (runError) return { error: runError.message }

  // Update schedule status and next run date if successful
  if (data.status === 'success') {
    const { data: schedule } = await supabase
      .from('payroll_schedules')
      .select('frequency, pay_day')
      .eq('id', data.schedule_id)
      .single()

    if (schedule) {
      const next_run_at = calculateNextRunDate(schedule.frequency, schedule.pay_day)
      await supabase
        .from('payroll_schedules')
        .update({ 
          status: 'draft', // Reset to draft for next cycle
          next_run_at 
        })
        .eq('id', data.schedule_id)
    }
  }

  revalidatePath('/dashboard/payroll/scheduled')
  return { success: true }
}

// Delete a schedule
export async function deletePayrollSchedule(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from('payroll_schedules')
    .delete()
    .eq('id', id)
    .eq('organization_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/payroll/scheduled')
  return { success: true }
}

// Check and update schedules that are due (can be called from a cron or on page load)
export async function checkDueSchedules() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const now = new Date().toISOString()

  // Find schedules where next_run_at has passed and status is draft
  const { data: dueSchedules, error } = await supabase
    .from('payroll_schedules')
    .select('id')
    .eq('organization_id', user.id)
    .eq('status', 'draft')
    .lte('next_run_at', now)

  if (error) return { error: error.message }

  // Mark them as ready
  for (const schedule of dueSchedules || []) {
    await updateScheduleStatus(schedule.id, 'ready')
  }

  return { success: true, count: dueSchedules?.length || 0 }
}

// Send payment confirmation email to a recipient
export async function notifyPaymentSent(data: {
  recipientWallet: string
  amount: string
  currency: 'STX' | 'BTC'
  txId: string
  // Optional: pass email directly to skip database lookup
  recipientEmail?: string
  recipientName?: string
}) {
  console.log('[notifyPaymentSent] Starting for wallet:', data.recipientWallet)
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.log('[notifyPaymentSent] Not authenticated')
    return { error: "Not authenticated" }
  }

  // Check if the sender has email notifications enabled
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('email_notifications, organization_name')
    .eq('id', user.id)
    .single()

  // If notifications are disabled, skip sending
  if (senderProfile?.email_notifications === false) {
    console.log('[notifyPaymentSent] Email notifications disabled for user:', user.id)
    return { success: true, emailSent: false, reason: 'notifications_disabled' }
  }

  // Use provided email/name if available, otherwise lookup from database
  let recipientEmail = data.recipientEmail
  let recipientName = data.recipientName || 'Recipient'

  if (!recipientEmail) {
    // Get recipient info by wallet address
    // Use ilike for case-insensitive matching
    console.log('[notifyPaymentSent] Looking up email for wallet:', data.recipientWallet)
    const { data: recipient, error: recipientError } = await supabase
      .from('team_members')
      .select('name, email, wallet_address')
      .eq('organization_id', user.id)
      .or(`wallet_address.ilike.${data.recipientWallet},btc_address.ilike.${data.recipientWallet}`)
      .maybeSingle()

    if (recipientError) {
      console.error('[notifyPaymentSent] Query error:', recipientError)
      return { success: false, error: recipientError.message }
    }

    console.log('[notifyPaymentSent] Query result:', recipient)

    if (!recipient?.email) {
      console.log('[notifyPaymentSent] No email found for recipient:', data.recipientWallet)
      return { success: true, emailSent: false, reason: 'no_email' }
    }

    recipientEmail = recipient.email
    recipientName = recipient.name || 'Recipient'
  }

  const orgName = senderProfile?.organization_name || 'Your Organization'

  // At this point recipientEmail is guaranteed to be defined
  if (!recipientEmail) {
    console.log('[notifyPaymentSent] No recipient email available')
    return { success: true, emailSent: false, reason: 'no_email' }
  }

  // Send email
  console.log('[notifyPaymentSent] Sending email to:', recipientEmail)
  try {
    await sendPaymentSentEmail({
      name: recipientName,
      email: recipientEmail,
      amount: data.amount,
      currency: data.currency,
      txId: data.txId,
      organizationName: orgName,
    })
    console.log('[notifyPaymentSent] Email sent successfully to:', recipientEmail)
    return { success: true, emailSent: true, recipientEmail }
  } catch (emailError: any) {
    console.error('[notifyPaymentSent] Email send error:', emailError)
    return { success: false, emailSent: false, error: emailError.message }
  }
}

