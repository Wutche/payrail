'use client'

import * as React from "react"
import { Calendar, Clock, AlertCircle, Play, Check, ExternalLink, Plus, Trash2, MoreHorizontal } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useStacks } from "@/hooks/useStacks"
import { useNotification } from "@/components/NotificationProvider"
import { Loader2 } from "lucide-react"
import { getPayrollSchedules, updateScheduleStatus, recordPayrollRun, checkDueSchedules, deletePayrollSchedule, notifyPaymentSent } from "@/app/actions/payroll"
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
        
        // Record the run
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
          console.log(`[BatchPayroll] Sending email to ${item.team_members.name} (${item.team_members.wallet_address})`)
          try {
            const result = await notifyPaymentSent({
              recipientWallet: item.team_members.wallet_address,
              amount: amountSTX.toFixed(6),
              currency: 'STX',
              txId: txId
            })
            console.log(`[BatchPayroll] Email result for ${item.team_members.name}:`, result)
          } catch (emailErr) {
            console.error(`[BatchPayroll] Email error for ${item.team_members.name}:`, emailErr)
          }
        }

        showNotification('success', 'Payroll Executed', `${recipients.length} payments broadcasted!`)
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
    
    try {
      await deletePayrollSchedule(deleteConfirm.scheduleId)
      showNotification('success', 'Deleted', 'Schedule has been deleted.')
      loadSchedules()
    } catch (err: any) {
      showNotification('error', 'Error', err.message)
    } finally {
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
            
            // Format date range
            const formatDateShort = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const dateRange = schedule.start_date 
              ? schedule.end_date 
                ? `${formatDateShort(schedule.start_date)} - ${formatDateShort(schedule.end_date)}`
                : `From ${formatDateShort(schedule.start_date)}`
              : 'Ongoing'
            
            return (
              <Card key={schedule.id} className="border-none shadow-sm overflow-hidden group">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-start md:items-center p-6 gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Calendar className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-xl">{schedule.name}</span>
                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                          {schedule.frequency}
                        </span>
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-1.5",
                          isReady ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                          isProcessing ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                          "bg-accent text-muted-foreground"
                        )}>
                          {isReady && <AlertCircle className="h-3 w-3" />}
                          {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                          {schedule.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm mt-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">Pay Day</span>
                          <span className="font-mono font-bold text-sm">
                            {formatPayDay(schedule.frequency, schedule.pay_day)}
                          </span>
                        </div>

                        <div className="flex flex-col sm:border-l sm:border-accent/30 sm:pl-4">
                          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">Next Run</span>
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            isReady ? "text-amber-500" : "text-foreground/70"
                          )}>
                            {formatNextRun(schedule.next_run_at, schedule.status)}
                          </span>
                        </div>

                        <div className="flex flex-col sm:border-l sm:border-accent/30 sm:pl-4">
                          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">Recipients</span>
                          <span className="font-bold text-sm">{recipientCount}</span>
                        </div>

                        <div className="flex flex-col sm:border-l sm:border-accent/30 sm:pl-4">
                          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">Duration</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm">{dateRange}</span>
                            {isExpired && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500">
                                Exp
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:border-l sm:border-accent/30 sm:pl-4 col-span-2 sm:col-span-1">
                          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-bold">Total</span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-lg">${totalAmount.toLocaleString()}</span>
                            {stxPrice > 0 && (
                              <span className="text-xs font-bold text-primary">
                                ≈ {(totalAmount / stxPrice).toFixed(2)} STX
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Recipients preview */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {schedule.payroll_schedule_items.slice(0, 3).map((item) => (
                          <span 
                            key={item.id}
                            className="text-[11px] text-muted-foreground font-mono bg-accent/30 px-2 py-1 rounded"
                          >
                            {item.team_members.name}: ${item.amount}
                          </span>
                        ))}
                        {recipientCount > 3 && (
                          <span className="text-[11px] text-muted-foreground px-2 py-1">
                            +{recipientCount - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                      {schedule.status === 'draft' && isDue && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => handleMarkReady(schedule.id)}
                        >
                          Mark Ready
                        </Button>
                      )}
                      
                      {schedule.status === 'draft' && !isDue && (
                        <span className="text-xs text-muted-foreground italic">
                          Due {formatNextRun(schedule.next_run_at, schedule.status)}
                        </span>
                      )}
                      
                      <Button 
                        className={cn(
                          "flex-1 md:flex-none rounded-xl font-bold px-8 transition-all",
                          isReady ? "bg-primary" : "bg-muted text-muted-foreground"
                        )}
                        onClick={() => handleRunPayroll(schedule)}
                        disabled={!isReady || isSubmitting === schedule.id}
                      >
                        {isSubmitting === schedule.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4 fill-current" />
                        )}
                        Run Payroll
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="text-red-500 focus:text-red-500"
                            onClick={() => handleDeleteRequest(schedule.id, schedule.name)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
      />
    </div>
  )
}
