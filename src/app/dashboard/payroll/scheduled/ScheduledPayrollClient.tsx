'use client'

import * as React from "react"
import { Calendar, Clock, AlertCircle, Play } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useStacks } from "@/hooks/useStacks"
import { useNotification } from "@/components/NotificationProvider"
import { Loader2 } from "lucide-react"
import { recordPayout } from "@/app/actions/team"
import { useRouter } from "next/navigation"

const calculateNextRun = (lastPayout: string | null, frequency: string) => {
  const now = new Date()
  if (!lastPayout) return { date: now, isDue: true, alreadyPaid: false, isInitial: true }

  const last = new Date(lastPayout)
  const next = new Date(last)

  switch (frequency.toLowerCase()) {
    case 'hourly': next.setHours(last.getHours() + 1); break
    case 'daily': next.setDate(last.getDate() + 1); break
    case 'weekly': next.setDate(last.getDate() + 7); break
    case 'monthly': next.setMonth(last.getMonth() + 1); break
    case 'yearly': next.setFullYear(last.getFullYear() + 1); break
    default: next.setMonth(last.getMonth() + 1)
  }

  // Use a slight buffer to avoid immediate "Due" status after refresh
  const bufferTime = 1000 * 60; // 1 minute
  const isDue = now.getTime() >= (next.getTime() - bufferTime)

  return { 
    date: next, 
    isDue,
    alreadyPaid: !isDue,
    isInitial: false
  }
}

export default function ScheduledPayrollPage({ initialRecipients = [] }: { initialRecipients: any[] }) {
  const { isConnected, connectWallet, executePayroll, transferBTC, getSTXPrice, getBTCPrice } = useStacks()
  const { showNotification } = useNotification()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null)
  const [isMounted, setIsMounted] = React.useState(false)
  const [currency, setCurrency] = React.useState<'STX' | 'BTC'>('STX')
  const [stxPrice, setStxPrice] = React.useState(0)
  const [btcPrice, setBtcPrice] = React.useState(0)

  React.useEffect(() => {
    setIsMounted(true)
    const fetchPrices = async () => {
      const [sPrice, bPrice] = await Promise.all([getSTXPrice(), getBTCPrice()])
      setStxPrice(sPrice)
      setBtcPrice(bPrice)
    }
    fetchPrices()
  }, [getSTXPrice, getBTCPrice])

  const currentPrice = currency === 'STX' ? stxPrice : btcPrice
  
  const schedules = initialRecipients.map(r => {
    const { date, isDue, alreadyPaid, isInitial } = calculateNextRun(r.last_payout_at, r.payment_frequency)
    return {
      id: r.id,
      recipient: r.name,
      address: r.wallet_address,
      btc_address: r.btc_address,
      amount: parseFloat(r.rate) || 0,
      frequency: r.payment_frequency.charAt(0).toUpperCase() + r.payment_frequency.slice(1),
      nextRun: isInitial ? "Initial Payment Due" : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: isDue ? "Ready" : "Scheduled",
      alreadyPaid
    }
  })

  const handleRunNow = async (item: any) => {
    if (!isConnected) {
      connectWallet()
      return
    }

    try {
      setIsSubmitting(item.id)
      
      const onSuccess = async () => {
        await recordPayout(item.id)
        showNotification('success', 'Payout Recorded', `Database updated for ${item.recipient}`)
        router.refresh()
      }

      if (currency === 'STX') {
        const amountInStx = stxPrice > 0 ? (item.amount / stxPrice) : 0
        if (amountInStx > 0) {
            await executePayroll(item.address, amountInStx, onSuccess)
        }
      } else {
        const btcAddress = item.btc_address
        if (!btcAddress) {
            showNotification('error', 'Missing BTC Address', `No Bitcoin address found for ${item.recipient}`)
            setIsSubmitting(null)
            return
        }
        const amountInBtc = btcPrice > 0 ? (item.amount / btcPrice) : 0
        if (amountInBtc > 0) {
            await transferBTC(btcAddress, amountInBtc, onSuccess)
        }
      }
    } catch (err: any) {
      // Handled by useStacks
    } finally {
      setIsSubmitting(null)
    }
  }

  if (!isMounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Payrolls</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage recurring on-chain payment schedules.</p>
        </div>
        <div className="flex bg-accent rounded-xl p-1 shrink-0">
          <Button 
            variant={currency === 'STX' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-md h-8 text-xs font-bold"
            onClick={() => setCurrency('STX')}
          >
            STX
          </Button>
          <Button 
            variant={currency === 'BTC' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-md h-8 text-xs font-bold"
            onClick={() => setCurrency('BTC')}
          >
            BTC
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {schedules.length > 0 ? (
          schedules.map((item, idx) => (
            <Card key={idx} className="border-none shadow-sm overflow-hidden group">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row items-center p-6 gap-6">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Calendar className="h-6 w-6" />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{item.recipient}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 uppercase tracking-wider">
                        {item.frequency}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Next Run: {item.nextRun}
                      </span>
                      <span className="font-bold text-foreground">
                          ${item.amount.toLocaleString()}
                      </span>
                      {currentPrice > 0 && (
                          <span className="text-xs font-bold text-primary animate-pulse">
                              ≈ {(item.amount / currentPrice).toFixed(currency === 'BTC' ? 6 : 2)} {currency}
                          </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-1">
                      {currency === 'STX' ? item.address : (item.btc_address || 'No BTC Address')}
                    </div>
                  </div>

                    <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                      {item.status === "Ready" && (
                        <div className="flex items-center gap-2 mr-4 text-amber-600 animate-pulse">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-tighter">Action Required</span>
                        </div>
                      )}
                      {item.alreadyPaid && (
                        <div className="flex items-center gap-2 mr-4 text-green-600">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-bold uppercase tracking-tighter">Paid / Processing</span>
                        </div>
                      )}
                    <Button 
                      className="flex-1 md:flex-none rounded-xl font-bold bg-primary px-8"
                      onClick={() => handleRunNow(item)}
                      disabled={isSubmitting === item.id}
                    >
                      {isSubmitting === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4 fill-current" />
                      )}
                      Run Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-none shadow-sm bg-accent/5 border-2 border-dashed border-accent/20">
            <CardContent className="p-12 flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center text-muted-foreground mb-2">
                <Calendar className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">No Scheduled Payrolls</h3>
                <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                  You haven't scheduled any recurring payments yet. Add team members with a payment frequency to see them here.
                </p>
              </div>
              <Button 
                variant="outline" 
                className="rounded-xl font-bold px-8 mt-4 hover:bg-primary hover:text-white hover:border-primary transition-all"
                asChild
              >
                <a href="/dashboard/recipients">Add Recipients</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
