'use client'

import * as React from "react"
import { Calendar, Clock, AlertCircle, Play, Check, ExternalLink, Plus, Trash2, MoreHorizontal, Users, CreditCard, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useStacks } from "@/hooks/useStacks"
import { useNotification } from "@/components/NotificationProvider"
import { Loader2 } from "lucide-react"
import { getPayrollSchedules, updateScheduleStatus, recordPayrollRun, checkDueSchedules, deletePayrollSchedule, notifyPaymentSent, verifyTransactionStatus } from "@/app/actions/payroll"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { CreateScheduleModal } from "@/components/dashboard/CreateScheduleModal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface ScheduleItem {
  id: string
  amount: number
  team_member_id: string
  team_members: {
    id: string
    name: string
    email?: string
    wallet_address: string
    btc_address?: string
  }
}

interface PayrollSchedule {
  id: string
  name: string
  frequency: 'weekly' | 'monthly'
  pay_day: number
  status: 'draft' | 'ready' | 'processing' | 'paid'
  next_run_at: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  payroll_schedule_items: ScheduleItem[]
}

const formatPayDay = (frequency: string, payDay: number) => {
  if (frequency === 'weekly') {
    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return days[payDay] || `Day ${payDay}`
  }
  return `Day ${payDay}`
}

const formatNextRun = (nextRunAt: string | null, status: string) => {
  if (status === 'ready') return 'Ready to Run'
  if (!nextRunAt) return 'Not scheduled'
  const date = new Date(nextRunAt)
  // Use en-GB locale for day/month/year format
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ScheduledPayrollPage({ initialRecipients = [] }: { initialRecipients: any[] }) {
  const { 
    isConnected, 
    connectWallet, 
    executeBatchPayroll, 
    getSTXPrice, 
    address: myAddress
  } = useStacks()
  const { showNotification } = useNotification()
  const router = useRouter()
  
  const [schedules, setSchedules] = React.useState<PayrollSchedule[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null)
  const [isMounted, setIsMounted] = React.useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [stxPrice, setStxPrice] = React.useState(0)

  // Load schedules
  const loadSchedules = React.useCallback(async () => {
    try {
      // First check for due schedules and mark them ready
      await checkDueSchedules()
      
      const result = await getPayrollSchedules()
      if (result.error) throw new Error(result.error)
      setSchedules(result.data || [])
    } catch (err: any) {
      showNotification('error', 'Error', err.message)
    } finally {
      setIsLoading(false)
    }
  }, [showNotification])

  React.useEffect(() => {
    setIsMounted(true)
    loadSchedules()
    
    const fetchPrice = async () => {
      let price = await getSTXPrice()
      // Retry once if price is 0 (API may have rate limited)
      if (price === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        price = await getSTXPrice()
      }
      setStxPrice(price)
    }
    fetchPrice()
    
    // Refresh price every 30 seconds to keep it current
    const priceInterval = setInterval(fetchPrice, 30000)
    return () => clearInterval(priceInterval)
  }, [loadSchedules, getSTXPrice])

  const handleRunPayroll = async (schedule: PayrollSchedule) => {
    if (!isConnected) {
      connectWallet()
      return
    }

    if (schedule.payroll_schedule_items.length === 0) {
      showNotification('error', 'Error', 'No recipients in this schedule.')
      return
    }

    // Try to get fresh price if current price is 0
    let currentPrice = stxPrice
    if (currentPrice <= 0) {
      showNotification('info', 'Fetching Price', 'Getting current STX price...')
      currentPrice = await getSTXPrice()
      if (currentPrice > 0) {
        setStxPrice(currentPrice)
      }
    }

    // Validate that we have a valid STX price before proceeding
    if (currentPrice <= 0) {
      showNotification('error', 'Price Not Available', 'Unable to fetch STX price. Please wait a moment and try again.')
      return
    }

    try {
      setIsSubmitting(schedule.id)
      
      // Update status to processing
      await updateScheduleStatus(schedule.id, 'processing')

      // DEBUG: Log full schedule data to see if email is present
      console.log('[BatchPayroll] Full schedule data:', JSON.stringify(schedule, null, 2))

      // Build recipients list for batch payroll
      const recipients = schedule.payroll_schedule_items.map(item => ({
        address: item.team_members.wallet_address,
        amountSTX: currentPrice > 0 ? item.amount / currentPrice : 0
      }))

      // Period reference for the batch
      const periodRef = `${schedule.name}-${new Date().toISOString().slice(0, 7)}`

      // Execute batch payroll
      await executeBatchPayroll(recipients, periodRef, async (data: any) => {
        const txId = data.txId || ""
        const totalAmount = schedule.payroll_schedule_items.reduce((sum, i) => sum + i.amount, 0)
        
        // Verify transaction on-chain before sending notifications
        showNotification('info', 'Verifying Transaction', 'Waiting for on-chain confirmation...')
        
        const verification = await verifyTransactionStatus(txId, 12, 10000) // 12 attempts, 10s each = 2 minutes
        
        if (!verification.success) {
          // Transaction failed on-chain - DO NOT send success emails
          console.error(`[BatchPayroll] Transaction FAILED: ${verification.error}`)
          showNotification('error', 'Transaction Failed', verification.error || 'The on-chain transaction failed. No payments were made.')
          
          // Record the failed run
          await recordPayrollRun({
            schedule_id: schedule.id,
            status: 'failed',
            tx_id: txId,
            total_amount: totalAmount,
            recipient_count: recipients.length
          })
          
          // Reset status back to ready so they can try again
          await updateScheduleStatus(schedule.id, 'ready')
          loadSchedules()
          return
        }
        
        // Transaction confirmed successfully - now send emails
        console.log(`[BatchPayroll] Transaction CONFIRMED! Sending emails...`)
        
        // Record the successful run
        await recordPayrollRun({
          schedule_id: schedule.id,
          status: 'success',
          tx_id: txId,
          total_amount: totalAmount,
          recipient_count: recipients.length
        })

        // Send email notifications to each recipient
        console.log(`[BatchPayroll] Sending emails to ${schedule.payroll_schedule_items.length} recipients`)
        for (const item of schedule.payroll_schedule_items) {
          const amountSTX = currentPrice > 0 ? item.amount / currentPrice : 0
          const teamMember = item.team_members
          console.log(`[BatchPayroll] Sending email to ${teamMember.name} (${teamMember.email || 'no email'})`)
          
          if (!teamMember.email) {
            console.log(`[BatchPayroll] Skipping ${teamMember.name} - no email address`)
            continue
          }
          
          try {
            const result = await notifyPaymentSent({
              recipientWallet: teamMember.wallet_address,
              amount: amountSTX.toFixed(6),
              currency: 'STX',
              txId: txId,
              // Pass email directly to avoid database lookup issues
              recipientEmail: teamMember.email,
              recipientName: teamMember.name
            })
            console.log(`[BatchPayroll] Email result for ${teamMember.name}:`, result)
          } catch (emailErr) {
            console.error(`[BatchPayroll] Email error for ${teamMember.name}:`, emailErr)
          }
        }

        showNotification('success', 'Payroll Confirmed!', `${recipients.length} payments confirmed on-chain.`)
        router.refresh()
        loadSchedules()
      })
    } catch (err: any) {
      console.error("Batch Payroll Error:", err)
      showNotification('error', 'Payroll Error', err.message || 'An unexpected error occurred.')
      
      // Reset status on error
      await updateScheduleStatus(schedule.id, 'ready')
    } finally {
      setIsSubmitting(null)
    }
  }

  const handleMarkReady = async (scheduleId: string) => {
    try {
      await updateScheduleStatus(scheduleId, 'ready')
      showNotification('success', 'Status Updated', 'Schedule marked as ready.')
      loadSchedules()
    } catch (err: any) {
      showNotification('error', 'Error', err.message)
    }
  }

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = React.useState<{ isOpen: boolean; scheduleId: string | null; scheduleName: string }>({
    isOpen: false,
    scheduleId: null,
    scheduleName: ''
  })

  const handleDeleteRequest = (scheduleId: string, scheduleName: string) => {
    setDeleteConfirm({ isOpen: true, scheduleId, scheduleName })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.scheduleId) return
    
    setIsDeleting(true)
    try {
      await deletePayrollSchedule(deleteConfirm.scheduleId)
      showNotification('success', 'Deleted', 'Schedule has been deleted.')
      loadSchedules()
    } catch (err: any) {
      showNotification('error', 'Error', err.message)
    } finally {
      setIsDeleting(false)
      setDeleteConfirm({ isOpen: false, scheduleId: null, scheduleName: '' })
    }
  }

  // Calculate due schedules
  const today = new Date().toISOString().split('T')[0]
  const dueSchedules = schedules.filter(s => {
    if (!s.next_run_at) return false
    const nextRun = new Date(s.next_run_at).toISOString().split('T')[0]
    return (s.status === 'ready' || s.status === 'draft') && nextRun <= today
  })
  const dueCount = dueSchedules.length

  // Pay All Due handler
  const [isPayingAll, setIsPayingAll] = React.useState(false)
  
  const handlePayAllDue = async () => {
    if (dueSchedules.length === 0) return
    
    setIsPayingAll(true)
    
    try {
      for (const schedule of dueSchedules) {
        if (schedule.status !== 'ready') {
          // First mark as ready
          await handleMarkReady(schedule.id)
        }
        // Then run payroll - note: this triggers wallet popup but doesn't wait for approval
        // Success notifications are handled in the onFinish callback of executeBatchPayroll
        await handleRunPayroll(schedule)
      }
      // Don't show success here - the individual onFinish callbacks handle success notifications
      // after the user actually approves each transaction on-chain
    } catch (err: any) {
      showNotification('error', 'Error', err.message || 'An error occurred while processing payrolls')
    } finally {
      setIsPayingAll(false)
    }
  }

  if (!isMounted) return null

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Due Count Alert */}
      {dueCount > 0 && (
        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-full animate-pulse shrink-0">
              {dueCount} Due
            </div>
            <span className="text-sm text-muted-foreground">
              {dueCount === 1 ? '1 payroll is' : `${dueCount} payrolls are`} ready to be paid
            </span>
          </div>
          <Button 
            className="w-full sm:w-auto rounded-xl font-bold bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg"
            onClick={handlePayAllDue}
            disabled={isPayingAll}
          >
            {isPayingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4 fill-current" />
            )}
            Pay All Due
          </Button>
        </div>
      )}

      {/* Create Schedule Button */}
      <div className="flex justify-end">
        <Button 
          className="rounded-xl font-bold px-6 shadow-lg shadow-primary/20"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Schedule
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <Card className="border-none shadow-sm">
            <CardContent className="p-12 flex flex-col items-center text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground mt-4">Loading schedules...</p>
            </CardContent>
          </Card>
        ) : schedules.length > 0 ? (
          schedules.map((schedule) => {
            const totalAmount = schedule.payroll_schedule_items.reduce((sum, i) => sum + i.amount, 0)
            const recipientCount = schedule.payroll_schedule_items.length
            const isReady = schedule.status === 'ready'
            const isProcessing = schedule.status === 'processing'
            const isExpired = schedule.end_date && new Date(schedule.end_date) < new Date()
            
            // Check if schedule is due (next_run_at date has passed or is today)
            const isDue = schedule.next_run_at ? new Date(schedule.next_run_at) <= new Date() : false
            
            // Format date range (use en-GB for day/month format)
            const formatDateShort = (date: string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            const dateRange = schedule.start_date 
              ? schedule.end_date 
                ? `${formatDateShort(schedule.start_date)} - ${formatDateShort(schedule.end_date)}`
                : `From ${formatDateShort(schedule.start_date)}`
              : 'Ongoing'
            return (
              <Card key={schedule.id} className="border-none shadow-xl shadow-black/5 overflow-hidden group hover:ring-2 hover:ring-primary/20 transition-all duration-300 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-0">
                  <div className="flex flex-col">
                    {/* Top Section - Header-like */}
                    <div className="p-6 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.05]">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shrink-0 shadow-inner">
                          <Calendar className="h-7 w-7" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-xl tracking-tight leading-none">{schedule.name}</h3>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shadow-sm">
                                {schedule.frequency}
                              </span>
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm border",
                                isReady ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                isProcessing ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                "bg-muted text-muted-foreground border-transparent"
                              )}>
                                {isReady && <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                {isProcessing && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                                {schedule.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground/70 font-medium">
                            Created {new Date(schedule.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Total Payroll</p>
                          <div className="flex items-baseline justify-end gap-1.5">
                            <span className="text-2xl font-black tracking-tighter">${totalAmount.toLocaleString()}</span>
                            {stxPrice > 0 && (
                              <span className="text-xs font-bold text-primary">
                                ≈ {(totalAmount / stxPrice).toFixed(1)} STX
                              </span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-accent/50">
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-2xl bg-popover/90 backdrop-blur-md border border-white/10 shadow-2xl">
                            <DropdownMenuItem 
                              className="text-red-500 focus:text-red-500 focus:bg-red-500/10 rounded-xl px-3 py-2.5"
                              onClick={() => handleDeleteRequest(schedule.id, schedule.name)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span className="font-bold text-sm">Delete Schedule</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Middle Section - Stats Grid */}
                    <div className="px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 bg-gradient-to-b from-transparent to-accent/5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-muted-foreground/60">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Pay Day</span>
                        </div>
                        <p className="font-bold text-sm pl-5.5 italic">
                          {formatPayDay(schedule.frequency, schedule.pay_day)}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-l border-white/[0.05] pl-6">
                        <div className="flex items-center gap-2 text-muted-foreground/60">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Next Run</span>
                        </div>
                        <p className={cn(
                          "font-bold text-sm pl-5.5",
                          isReady ? "text-amber-500" : "text-foreground/80"
                        )}>
                          {formatNextRun(schedule.next_run_at, schedule.status)}
                        </p>
                      </div>

                      <div className="space-y-1.5 border-l border-white/[0.05] pl-6">
                        <div className="flex items-center gap-2 text-muted-foreground/60">
                          <Users className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Recipients</span>
                        </div>
                        <p className="font-bold text-sm pl-5.5">
                          {recipientCount} Members
                        </p>
                      </div>

                      <div className="space-y-1.5 border-l border-white/[0.05] pl-6">
                        <div className="flex items-center gap-2 text-muted-foreground/60">
                          <CreditCard className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Period</span>
                        </div>
                        <div className="flex items-center gap-2 pl-5.5">
                          <span className="font-bold text-sm truncate">{dateRange}</span>
                          {isExpired && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-red-500/20 text-red-500 border border-red-500/20">
                              EXPIRED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section - Recipients & Action */}
                    <div className="p-6 pt-4 flex flex-col md:flex-row items-center justify-between gap-6 bg-accent/10 border-t border-white/[0.05]">
                      <div className="w-full md:w-auto">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Recent Recipients</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {schedule.payroll_schedule_items.slice(0, 3).map((item) => (
                            <div 
                              key={item.id}
                              className="group/item flex items-center gap-2 bg-background/40 hover:bg-background/80 border border-white/[0.03] rounded-xl px-3 py-2 transition-all cursor-default"
                            >
                              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                {item.team_members.name.charAt(0)}
                              </div>
                              <span className="text-[11px] font-bold text-muted-foreground group-hover/item:text-foreground transition-colors">
                                {item.team_members.name}
                              </span>
                              <span className="text-[11px] font-black text-primary/80">
                                ${item.amount}
                              </span>
                            </div>
                          ))}
                          {recipientCount > 3 && (
                            <div className="h-9 px-3 flex items-center justify-center text-[11px] font-bold text-muted-foreground/60 bg-white/5 rounded-xl border border-dashed border-white/10">
                              +{recipientCount - 3} more
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto shrink-0">
                        {schedule.status === 'draft' && isDue && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-2xl h-12 px-6 font-bold hover:bg-primary/5 hover:text-primary transition-all text-sm"
                            onClick={() => handleMarkReady(schedule.id)}
                          >
                            Mark as Ready
                          </Button>
                        )}
                        
                        {schedule.status === 'draft' && !isDue && (
                          <div className="px-5 py-3 rounded-2xl bg-muted/30 border border-white/5 flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground/50" />
                            <span className="text-xs font-bold text-muted-foreground italic">
                              Ready in {formatNextRun(schedule.next_run_at, schedule.status)}
                            </span>
                          </div>
                        )}
                        
                        <Button 
                          className={cn(
                            "group/btn relative overflow-hidden flex-1 md:flex-none h-14 min-w-[180px] rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-500",
                            isReady 
                              ? "bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] hover:shadow-2xl hover:shadow-primary/30" 
                              : "bg-muted/50 text-muted-foreground cursor-not-allowed grayscale"
                          )}
                          onClick={() => handleRunPayroll(schedule)}
                          disabled={!isReady || isSubmitting === schedule.id}
                        >
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10 transition-all group-hover/btn:h-full group-hover/btn:bg-white/5" />
                          <div className="relative flex items-center justify-center gap-3">
                            {isSubmitting === schedule.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover/btn:rotate-12">
                                <Play className="h-4 w-4 fill-current ml-0.5" />
                              </div>
                            )}
                            <span>Run Payroll</span>
                            <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 transition-all group-hover/btn:opacity-100 group-hover/btn:translate-x-0" />
                          </div>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card className="border-none shadow-sm bg-accent/5 border-2 border-dashed border-accent/20">
            <CardContent className="p-12 flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center text-muted-foreground mb-2">
                <Calendar className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">No Scheduled Payrolls</h3>
                <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                  Create a recurring payroll schedule to automate your team payments.
                </p>
              </div>
              <Button 
                className="rounded-xl font-bold px-8 mt-4"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Schedule
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateScheduleModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadSchedules}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, scheduleId: null, scheduleName: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Schedule?"
        message={`Are you sure you want to delete "${deleteConfirm.scheduleName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Keep it"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
