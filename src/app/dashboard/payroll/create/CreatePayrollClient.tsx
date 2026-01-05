'use client'

import * as React from "react"
import { Send, Wallet, AlertCircle, Loader2, DollarSign, Plus, X, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

import { useStacks } from "@/hooks/useStacks"
import { useNotification } from "@/components/NotificationProvider"
import { getTeamMembers } from "@/app/actions/team"
import { notifyPaymentSent, verifyTransactionStatus } from "@/app/actions/payroll"
import { PaymentSuccessModal } from "@/components/ui/PaymentSuccessModal"

interface SelectedRecipient {
  id: string
  name: string
  wallet_address: string
  amount: string
}

export default function CreatePayrollPage() {
  const { isConnected, address, connectWallet, executePayroll, getSTXBalance, getSTXPrice, getBTCPrice } = useStacks()
  const { showNotification } = useNotification()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isMounted, setIsMounted] = React.useState(false)
  const [recipients, setRecipients] = React.useState<any[]>([])
  const [selectedRecipients, setSelectedRecipients] = React.useState<SelectedRecipient[]>([])
  const [currency, setCurrency] = React.useState<'STX' | 'BTC'>('STX')
  const [stxPrice, setStxPrice] = React.useState(0)
  const [btcPrice, setBtcPrice] = React.useState(0)
  const [balance, setBalance] = React.useState<number | null>(null)
  const [memo, setMemo] = React.useState("")
  
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

  const toggleRecipient = (recipient: any) => {
    const exists = selectedRecipients.find(r => r.id === recipient.id)
    if (exists) {
      setSelectedRecipients(prev => prev.filter(r => r.id !== recipient.id))
    } else {
      // Calculate amount from rate if available
      let defaultAmount = ""
      if (recipient.rate && currentPrice > 0) {
        const usdRate = parseFloat(recipient.rate)
        defaultAmount = (usdRate / currentPrice).toFixed(4)
      }
      setSelectedRecipients(prev => [...prev, {
        id: recipient.id,
        name: recipient.name,
        wallet_address: recipient.wallet_address,
        amount: defaultAmount
      }])
    }
  }

  const updateRecipientAmount = (id: string, amount: string) => {
    setSelectedRecipients(prev => prev.map(r => 
      r.id === id ? { ...r, amount } : r
    ))
  }

  const totalAmount = selectedRecipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

  const handleExecutePayroll = async () => {
    if (!isConnected) {
      connectWallet()
      return
    }

    if (selectedRecipients.length === 0) {
      showNotification("error", "Please select at least one recipient")
      return
    }

    const invalidRecipients = selectedRecipients.filter(r => !r.amount || parseFloat(r.amount) <= 0)
    if (invalidRecipients.length > 0) {
      showNotification("error", `Please enter valid amounts for all selected recipients`)
      return
    }

    try {
      setIsSubmitting(true)
      
      let successCount = 0
      let failCount = 0
      
      // Execute payments sequentially
      for (const recipient of selectedRecipients) {
        await executePayroll(recipient.wallet_address, parseFloat(recipient.amount), async (data: any) => {
          const txId = data.txId || ""
          
          // Verify transaction on-chain before sending email
          showNotification('info', 'Verifying Transaction', `Waiting for ${recipient.name}'s payment to confirm...`)
          
          const verification = await verifyTransactionStatus(txId, 12, 10000) // 12 attempts, 10s each = 2 minutes
          
          if (!verification.success) {
            // Transaction failed - DO NOT send success email
            console.error(`[PayNow] Transaction FAILED for ${recipient.name}: ${verification.error}`)
            showNotification('error', 'Transaction Failed', `Payment to ${recipient.name} failed: ${verification.error}`)
            failCount++
            return
          }
          
          // Transaction confirmed - send email
          console.log(`[PayNow] Transaction CONFIRMED for ${recipient.name}! Sending email...`)
          await notifyPaymentSent({
            recipientWallet: recipient.wallet_address,
            amount: recipient.amount,
            currency: 'STX',
            txId
          })
          successCount++
        })
      }

      // Show final summary
      if (successCount > 0) {
        const totalPaid = selectedRecipients.reduce((sum, r) => sum + parseFloat(r.amount), 0)
        showNotification('success', 'Payments Confirmed!', `${successCount} of ${selectedRecipients.length} payments confirmed on-chain.`)
        
        // Clear form only if at least one succeeded
        setSelectedRecipients([])
        setMemo("")
      }
      
      if (failCount > 0) {
        showNotification('info', 'Some Payments Failed', `${failCount} payment(s) failed on-chain. Please retry.`)
      }
      
      // Refresh wallet balance after a short delay
      setTimeout(async () => {
        if (address) {
          const newBalance = await getSTXBalance(address)
          setBalance(newBalance)
        }
      }, 3000)
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
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Select Recipients
              </CardTitle>
              <CardDescription>Choose team members to pay and set individual amounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : recipients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No recipients found</p>
                  <p className="text-sm">Add team members first to make payments.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {recipients.map((recipient) => {
                    const isSelected = selectedRecipients.find(r => r.id === recipient.id)
                    return (
                      <div 
                        key={recipient.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:border-primary/30 ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-border/50 bg-accent/30'
                        }`}
                        onClick={() => toggleRecipient(recipient)}
                      >
                        <Checkbox 
                          checked={!!isSelected}
                          onCheckedChange={() => toggleRecipient(recipient)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {recipient.wallet_address.substring(0, 12)}...{recipient.wallet_address.slice(-6)}
                          </p>
                        </div>
                        {recipient.rate && (
                          <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-lg">
                            ${recipient.rate}/mo
                          </span>
                        )}
                        {isSelected && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={isSelected.amount}
                              onChange={(e) => updateRecipientAmount(recipient.id, e.target.value)}
                              className="w-28 h-9 text-right rounded-lg font-mono"
                            />
                            <span className="text-xs text-muted-foreground font-bold">{currency}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {selectedRecipients.length > 0 && (
                <div className="pt-4 border-t border-border/50 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Selected Recipients</span>
                    <span className="font-bold">{selectedRecipients.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Amount</span>
                    <div className="text-right">
                      <span className="text-xl font-black">{totalAmount.toFixed(4)} {currency}</span>
                      {currentPrice > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ≈ ${(totalAmount * currentPrice).toFixed(2)} USD
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="memo">Memo / Reference (Optional)</Label>
                <Input 
                  id="memo" 
                  placeholder="e.g. January Salaries" 
                  className="rounded-xl"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl flex gap-3 mb-6">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Executing this payroll will trigger <b>Stacks Wallet popup(s)</b> for each recipient. Funds will move directly from your wallet to the recipients on-chain.
                  </p>
                </div>
                <Button 
                  onClick={handleExecutePayroll}
                  disabled={isSubmitting || selectedRecipients.length === 0}
                  className="w-full h-12 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 bg-primary group"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  )}
                  {selectedRecipients.length > 0 
                    ? `Pay ${selectedRecipients.length} Recipient${selectedRecipients.length > 1 ? 's' : ''} (${totalAmount.toFixed(4)} ${currency})`
                    : 'Select Recipients to Pay'
                  }
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
              {selectedRecipients.length > 0 && (
                <div className="flex justify-between text-primary">
                  <span>After Payment</span>
                  <span className="font-bold">
                    {balance !== null ? `${(balance - totalAmount).toLocaleString(undefined, { maximumFractionDigits: 4 })} STX` : "---"}
                  </span>
                </div>
              )}
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
