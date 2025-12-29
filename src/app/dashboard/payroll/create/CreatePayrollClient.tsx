'use client'

import * as React from "react"
import { Send, UserPlus, Wallet, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useStacks } from "@/hooks/useStacks"
import { useNotification } from "@/components/NotificationProvider"
import { getTeamMembers } from "@/app/actions/team"
import { notifyPaymentSent } from "@/app/actions/payroll"
import { PaymentSuccessModal } from "@/components/ui/PaymentSuccessModal"

export default function CreatePayrollPage() {
  const { isConnected, address, connectWallet, executePayroll, getSTXBalance, getSTXPrice, getBTCPrice } = useStacks()
  const { showNotification } = useNotification()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isMounted, setIsMounted] = React.useState(false)
  const [recipients, setRecipients] = React.useState<any[]>([])
  const [amount, setAmount] = React.useState("")
  const [recipient, setRecipient] = React.useState("")
  const [currency, setCurrency] = React.useState<'STX' | 'BTC'>('STX')
  const [stxPrice, setStxPrice] = React.useState(0)
  const [btcPrice, setBtcPrice] = React.useState(0)
  const [balance, setBalance] = React.useState<number | null>(null)
  
  // Success modal state
  const [successModal, setSuccessModal] = React.useState<{
    isOpen: boolean
    recipientName: string
    amount: string
    currency: 'STX' | 'BTC'
    txId: string
  }>({
    isOpen: false,
    recipientName: '',
    amount: '',
    currency: 'STX',
    txId: ''
  })

  React.useEffect(() => {
    setIsMounted(true)
    async function loadData() {
      try {
        const [teamRes, sPrice, bPrice] = await Promise.all([
          getTeamMembers(),
          getSTXPrice(),
          getBTCPrice()
        ])
        if (teamRes.error) throw new Error(teamRes.error)
        setRecipients(teamRes.data || [])
        setStxPrice(sPrice)
        setBtcPrice(bPrice)

        if (address) {
          const bal = await getSTXBalance(address)
          setBalance(bal)
        }
      } catch (err) {
        showNotification("error", "Failed to load dashboard data")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [address])

  const currentPrice = currency === 'STX' ? stxPrice : btcPrice

  const handleExecutePayroll = async () => {
    if (!isConnected) {
      connectWallet()
      return
    }

    if (!recipient || !amount) {
      showNotification("error", "Please enter recipient and amount")
      return
    }

    try {
      setIsSubmitting(true)
      
      const selectedRecipient = recipients.find((r) => 
        (currency === 'STX' ? r.wallet_address : (r.btc_address || r.wallet_address)) === recipient
      )
      const recipientName = selectedRecipient?.name || 'Recipient'
      
      // Execute STX payment (BTC is coming soon)
      await executePayroll(recipient, parseFloat(amount), async (data: any) => {
          const txId = data.txId || ""
          // Show success modal
          setSuccessModal({
            isOpen: true,
            recipientName,
            amount,
            currency: 'STX',
            txId
          })
          // Send email notification to recipient
          await notifyPaymentSent({
            recipientWallet: recipient,
            amount,
            currency: 'STX',
            txId
          })
          // Clear form
          setRecipient("")
          setAmount("")
          // Refresh wallet balance after a short delay
          setTimeout(async () => {
            if (address) {
              const newBalance = await getSTXBalance(address)
              setBalance(newBalance)
            }
          }, 3000)
      })
    } catch (err: any) {
      console.error("Create Payroll Error:", err)
      showNotification('error', 'Payment Error', err.message || 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isMounted) return null

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Currency Toggle */}
      <div className="flex justify-end sticky top-[72px] z-30 py-2 bg-background/50 backdrop-blur-sm -mx-4 px-4 sm:static sm:bg-transparent sm:p-0 sm:m-0">
        <div className="flex bg-accent rounded-xl p-1 shrink-0 shadow-lg sm:shadow-none">
          <Button 
            variant={currency === 'STX' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-md h-8 px-4 text-[10px] sm:text-xs font-bold"
            onClick={() => setCurrency('STX')}
          >
            STX
          </Button>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-md h-8 px-4 text-[10px] sm:text-xs font-bold"
              onClick={() => {
                showNotification('info', 'Coming Soon', 'Bitcoin payments will be available once sBTC launches. Stay tuned!')
              }}
            >
              BTC
            </Button>
            <div className="absolute -top-1 -right-1 pointer-events-none">
              <span className="text-[6px] sm:text-[7px] font-black uppercase tracking-tight bg-orange-500 text-white px-1 py-0.5 rounded-full animate-pulse">
                Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Payroll Configuration</CardTitle>
              <CardDescription>Enter the recipient details and STX amount for this run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="recipient">Select Recipient Wallet</Label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select onValueChange={(val) => {
                    setRecipient(val)
                    // Auto-fill amount from recipient's rate
                    const selected = recipients.find((r) => 
                      (currency === 'STX' ? r.wallet_address : (r.btc_address || r.wallet_address)) === val
                    )
                    console.log('Selected recipient:', selected, 'Price:', stxPrice, btcPrice)
                    if (selected?.rate) {
                      // Convert USD rate to crypto amount
                      const usdRate = parseFloat(selected.rate)
                      const price = currency === 'STX' ? stxPrice : btcPrice
                      console.log('USD Rate:', usdRate, 'Crypto Price:', price)
                      if (price > 0) {
                        const cryptoAmount = (usdRate / price).toFixed(4)
                        console.log('Setting amount to:', cryptoAmount)
                        setAmount(cryptoAmount)
                      } else {
                        // If price not loaded yet, just set a placeholder
                        setAmount(usdRate.toString())
                      }
                    }
                  }}>
                    <SelectTrigger className="pl-10 rounded-xl">
                      <SelectValue placeholder={isLoading ? "Loading recipients..." : "Search or select a registered wallet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {recipients.length === 0 && !isLoading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground italic">
                          No recipients found. Please add members first.
                        </div>
                      ) : (
                        recipients.map((r) => (
                          <SelectItem key={r.id} value={currency === 'STX' ? r.wallet_address : (r.btc_address || r.wallet_address)}>
                            {r.name} ({currency === 'STX' ? 'STX' : 'BTC'}) {r.rate ? `- $${r.rate}/mo` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                  <Label htmlFor="amount">Amount ({currency})</Label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="amount" 
                      type="number" 
                      placeholder="0.00" 
                      className="pl-10 pr-16 rounded-xl" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    {amount && currentPrice > 0 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        ≈ ${(parseFloat(amount) * currentPrice).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>


              <div className="space-y-2">
                <Label htmlFor="memo">Memo / Reference (Optional)</Label>
                <Input id="memo" placeholder="e.g. Oct UI Support" className="rounded-xl" />
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl flex gap-3 mb-6">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Executing this payroll will trigger a <b>Stacks Wallet popup</b>. Funds will move directly from your wallet to the recipient on-chain.
                  </p>
                </div>
                <Button 
                  onClick={handleExecutePayroll}
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 bg-primary group"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  )}
                  Execute On-Chain Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-accent/20">
            <CardHeader>
              <CardTitle className="text-lg">Wallet Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address</span>
                <span className="font-mono">
                  {address ? `${address.substring(0, 5)}...${address.substring(address.length - 4)}` : "Not Connected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available</span>
                <span className="font-bold">{balance !== null ? `${balance.toLocaleString()} STX` : "--- STX"}</span>
              </div>
              <div className="pt-2 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground italic text-center">
                  Funds are never held by Payrail. You control your private keys.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PaymentSuccessModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
        recipientName={successModal.recipientName}
        amount={successModal.amount}
        currency={successModal.currency}
        txId={successModal.txId}
      />
    </div>
  )
}
