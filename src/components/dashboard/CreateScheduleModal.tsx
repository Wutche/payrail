"use client"

import * as React from "react"
import { Calendar, Users, Plus, Loader2, DollarSign, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useNotification } from "@/components/NotificationProvider"
import { Modal } from "./ActionModals"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { createPayrollSchedule } from "@/app/actions/payroll"
import { getTeamMembers } from "@/app/actions/team"

interface TeamMember {
  id: string
  name: string
  wallet_address: string
  rate?: string
}

interface SelectedItem {
  team_member_id: string
  amount: number
}

interface CreateScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const daysOfWeek = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
]

const daysOfMonth = Array.from({ length: 28 }, (_, i) => ({
  value: i + 1,
  label: `Day ${i + 1}`
}))

export function CreateScheduleModal({ isOpen, onClose, onSuccess }: CreateScheduleModalProps) {
  const [name, setName] = React.useState("")
  const [frequency, setFrequency] = React.useState<'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly'>('monthly')
  const [minuteInterval, setMinuteInterval] = React.useState(5) // 5, 10, 15, 20, 30, 60
  const [payDay, setPayDay] = React.useState(1)
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [selectedItems, setSelectedItems] = React.useState<SelectedItem[]>([])
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { showNotification } = useNotification()

  // Load team members when modal opens
  React.useEffect(() => {
    async function loadMembers() {
      if (!isOpen) return
      setIsLoading(true)
      try {
        const result = await getTeamMembers()
        if (result.error) throw new Error(result.error)
        setTeamMembers(result.data || [])
      } catch (err: any) {
        showNotification('error', 'Error', err.message)
      } finally {
        setIsLoading(false)
      }
    }
    loadMembers()
  }, [isOpen, showNotification])

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setName("")
      setFrequency('monthly')
      setMinuteInterval(5)
      setPayDay(1)
      setStartDate("")
      setEndDate("")
      setSelectedItems([])
    }
  }, [isOpen])

  const toggleMember = (memberId: string) => {
    const exists = selectedItems.find(i => i.team_member_id === memberId)
    if (exists) {
      setSelectedItems(prev => prev.filter(i => i.team_member_id !== memberId))
    } else {
      const member = teamMembers.find(m => m.id === memberId)
      setSelectedItems(prev => [...prev, {
        team_member_id: memberId,
        amount: member?.rate ? parseFloat(member.rate) : 0
      }])
    }
  }

  const updateAmount = (memberId: string, amount: number) => {
    setSelectedItems(prev => prev.map(item => 
      item.team_member_id === memberId ? { ...item, amount } : item
    ))
  }

  const totalAmount = selectedItems.reduce((sum, item) => sum + item.amount, 0)

  const handleSubmit = async () => {
    if (!name.trim()) {
      showNotification('error', 'Validation Error', 'Please enter a schedule name.')
      return
    }
    if (selectedItems.length === 0) {
      showNotification('error', 'Validation Error', 'Please select at least one team member.')
      return
    }
    if (selectedItems.some(i => i.amount <= 0)) {
      showNotification('error', 'Validation Error', 'All amounts must be greater than 0.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createPayrollSchedule({
        name: name.trim(),
        frequency,
        pay_day: payDay,
        interval_minutes: frequency === 'minutes' ? minuteInterval : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        items: selectedItems
      })

      if (result.error) throw new Error(result.error)

      showNotification('success', 'Schedule Created', `${name} has been scheduled.`)
      onSuccess?.()
      onClose()
    } catch (err: any) {
      showNotification('error', 'Error', err.message || 'Failed to create schedule.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Payroll Schedule"
      description="Set up a recurring payroll for your team members."
    >
      <div className="space-y-6">
        {/* Schedule Name */}
        <div className="space-y-2">
          <Label htmlFor="schedule-name">Schedule Name</Label>
          <Input
            id="schedule-name"
            placeholder="e.g. Monthly Developer Payroll"
            className="rounded-xl h-12"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Frequency Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label>Frequency</Label>
            <div className="flex flex-wrap bg-accent/50 rounded-xl p-1 gap-1">
              <Button
                variant={frequency === 'minutes' ? 'default' : 'ghost'}
                className="flex-1 min-w-[80px] rounded-lg h-10 text-xs font-semibold"
                onClick={() => setFrequency('minutes')}
              >
                Minutes
              </Button>
              <Button
                variant={frequency === 'hourly' ? 'default' : 'ghost'}
                className="flex-1 min-w-[80px] rounded-lg h-10 text-xs font-semibold"
                onClick={() => setFrequency('hourly')}
              >
                Hourly
              </Button>
              <Button
                variant={frequency === 'daily' ? 'default' : 'ghost'}
                className="flex-1 min-w-[80px] rounded-lg h-10 text-xs font-semibold"
                onClick={() => setFrequency('daily')}
              >
                Daily
              </Button>
              <Button
                variant={frequency === 'weekly' ? 'default' : 'ghost'}
                className="flex-1 min-w-[80px] rounded-lg h-10 text-xs font-semibold"
                onClick={() => { setFrequency('weekly'); setPayDay(5) }}
              >
                <Clock className="mr-1 h-3 w-3" />
                Weekly
              </Button>
              <Button
                variant={frequency === 'monthly' ? 'default' : 'ghost'}
                className="flex-1 min-w-[80px] rounded-lg h-10 text-xs font-semibold"
                onClick={() => { setFrequency('monthly'); setPayDay(1) }}
              >
                <Calendar className="mr-1 h-3 w-3" />
                Monthly
              </Button>
            </div>
          </div>

          {/* Minute Interval Selector - only show for minutes frequency */}
          {frequency === 'minutes' && (
            <div className="space-y-2">
              <Label>Run Every</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 5, 10, 15, 20, 30, 60].map((mins) => (
                  <Button
                    key={mins}
                    variant={minuteInterval === mins ? 'default' : 'outline'}
                    className="flex-1 min-w-[60px] rounded-lg h-10 text-xs font-semibold"
                    onClick={() => setMinuteInterval(mins)}
                  >
                    {mins} mins
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Only show Pay Day for weekly/monthly */}
          {(frequency === 'weekly' || frequency === 'monthly') && (
            <div className="space-y-2 col-span-2">
              <Label>Pay Day</Label>
              <Select 
                value={payDay.toString()} 
                onValueChange={(val) => setPayDay(parseInt(val))}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {(frequency === 'weekly' ? daysOfWeek : daysOfMonth).map(day => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Schedule Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              className="rounded-xl h-10"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">
              End Date <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <Input
              id="end-date"
              type="date"
              className="rounded-xl h-10"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Team Members Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Select Recipients
            </Label>
            <span className="text-xs text-muted-foreground">
              {selectedItems.length} selected
            </span>
          </div>

          <div className="border rounded-2xl overflow-hidden max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading team members...</p>
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No team members found.</p>
                <p className="text-xs text-muted-foreground mt-1">Add recipients first to create schedules.</p>
              </div>
            ) : (
              teamMembers.map((member) => {
                const isSelected = selectedItems.some(i => i.team_member_id === member.id)
                const selectedItem = selectedItems.find(i => i.team_member_id === member.id)
                
                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-4 border-b last:border-b-0 transition-colors ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-accent/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMember(member.id)}
                        className="h-5 w-5"
                      />
                      <div>
                        <p className="font-semibold text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {member.wallet_address.slice(0, 8)}...{member.wallet_address.slice(-4)}
                        </p>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          className="w-24 h-8 text-sm rounded-lg"
                          placeholder="0.00"
                          value={selectedItem?.amount || ''}
                          onChange={(e) => updateAmount(member.id, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Summary */}
        {selectedItems.length > 0 && (
          <div className="bg-accent/30 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recipients</span>
              <span className="font-bold">{selectedItems.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total per {frequency === 'weekly' ? 'Week' : 'Month'}</span>
              <span className="font-bold text-primary">${totalAmount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 bg-primary group"
          onClick={handleSubmit}
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Plus className="mr-2 h-5 w-5 transition-transform group-hover:rotate-90" />
          )}
          Create Schedule
        </Button>
      </div>
    </Modal>
  )
}
