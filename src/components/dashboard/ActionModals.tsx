"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Send,
  UserPlus,
  Loader2,
  CreditCard,
  Wallet,
  Lock,
  Calendar,
  X,
  Info,
  CheckCircle2,
  ArrowDownLeft,
  Copy
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useNotification } from "@/components/NotificationProvider"
import { useStacks } from "@/hooks/useStacks"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { addTeamMember, updateTeamMember } from "@/app/actions/team"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export interface EnrichedTransaction {
  id: string
  txId: string
  date: string
  timestamp: string // ISO string
  recipientName: string
  recipientAddress: string
  senderName: string
  senderAddress: string
  amount: string
  amountUSD?: string
  status: string
  rawStatus: string
  type: string // "Manual" | "Scheduled"
  txType: string // "Transfer" | "Contract Call"
  fee: string
  blockHeight: number
  nonce: number
  explorerLink: string
  txResult?: string
}

/**
 * Truncates a wallet address or transaction ID.
 * @param address The address to truncate
 * @param startChars Number of characters to show at the start (default: 4)
 * @param endChars Number of characters to show at the end (default: 4)
 */
export function truncateAddress(address: string, startChars = 4, endChars = 4) {
  if (!address || address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Enriches a raw Stacks transaction with application-specific data.
 */
export function enrichTransaction(
  tx: any, 
  members: any[] = [], 
  orgName: string = "Organization",
  currentAddress: string = "",
  stxPrice: number = 0
): EnrichedTransaction {
  const isSent = tx.sender_address === currentAddress
  
  // Determine amount
  let amount = 0
  if (tx.tx_type === 'token_transfer') {
    amount = Number(tx.token_transfer.amount) / 1_000_000
  } else if (tx.tx_type === 'smart_contract' || tx.tx_type === 'contract_call') {
    // Try to find amount in function args if it's a known contract call
    // or just assume 0 for now if complex
    amount = 0 // In a real app we'd parse this better
    if (tx.contract_call?.function_name === 'execute-payroll') {
        // extract amount from args if possible, usually 2nd arg
        // but raw args are complex to parse without a library helper here
        // fallback to stx_sent if available in metadata
        amount = (Number(tx.fee_rate) / 1_000_000) // Default to fee for now if 0, but usually we want mapped amount
    }
  }
  // If we have explicit stx_sent/received fields from Hiroshima API
  if (isSent && tx.stx_sent) amount = Number(tx.stx_sent) / 1_000_000
  if (!isSent && tx.stx_received) amount = Number(tx.stx_received) / 1_000_000

  // Resolve Recipient
  let recipientAddress = tx.token_transfer?.recipient_address || 
                         (isSent ? 'Unknown' : currentAddress)

  // Handle Contract Calls for specific functions (e.g. execute-payroll)
  if (tx.tx_type === 'contract_call' || tx.tx_type === 'smart_contract') {
      if (tx.contract_call?.function_name === 'execute-payroll') {
        // Try to extract real recipient from args
        // Args usually come as { repr: 'ST...' } or { hex: ... } in API response
        const args = tx.contract_call.function_args || []
        if (args.length > 0 && args[0].repr) {
             // repr might be 'ST...' (quoted) or just ST... depending on API version
             // safely strip quotes if present
             recipientAddress = args[0].repr.replace(/^'/, '').replace(/'$/, '')
        }
        
        if (args.length > 1 && args[1].repr) {
             // Amount is usually u1000000
             const rawAmt = args[1].repr.replace('u', '')
             const parsed = parseInt(rawAmt)
             if (!isNaN(parsed)) {
                 amount = parsed / 1_000_000
             }
        }
      } else {
        // Fallback for other contract calls
        recipientAddress = tx.contract_call?.contract_id || ''
      }
  }

  // If it's a contract call we initiated, the "recipient" in our context might be the person we paid
  // But the tx recipient is the contract. 
  // For 'execute-payroll', the first arg is the recipient. 
  // We'll stick to the raw tx recipient (contract) or transfer recipient for absolute truth,
  // BUT we can try to look up the 'real' recipient if we can parse args.
  // For now, let's stick to the Transfer recipient or the Contract address.
  
  // Try to find recipient name in members
  // For batch payroll expanded rows, use the _batchRecipientName if set
  let recipientName: string;
  if (tx._batchRecipientName) {
    recipientName = tx._batchRecipientName;
  } else {
    const member = members.find(m => m.wallet_address === recipientAddress)
    recipientName = member ? member.name : (isSent ? truncateAddress(recipientAddress) : orgName)
  }
  
  const senderName = isSent ? orgName : (members.find(m => m.wallet_address === tx.sender_address)?.name || truncateAddress(tx.sender_address))

  // Payroll Type - better naming for UX
  const isContractCall = tx.tx_type === 'contract_call' || tx.tx_type === 'smart_contract'
  const functionName = tx.contract_call?.function_name
  const payrollType = isContractCall 
    ? (functionName === 'execute-batch-payroll' ? 'Batch Payroll' : 
       functionName === 'execute-payroll' ? 'One-time' : 
       functionName === 'register-business' ? 'Registration' :
       functionName === 'create-organization' ? 'Organization Setup' : 'Contract Call')
    : 'One-time'

  return {
    id: tx.tx_id,
    txId: tx.tx_id,
    date: new Date(tx.burn_block_time * 1000).toLocaleString(),
    timestamp: new Date(tx.burn_block_time * 1000).toISOString(),
    recipientName,
    recipientAddress,
    senderName,
    senderAddress: tx.sender_address,
    amount: `${amount.toLocaleString()} STX`,
    amountUSD: stxPrice ? `$${(amount * stxPrice).toFixed(2)}` : undefined,
    status: formatTxStatus(tx.tx_status),
    rawStatus: tx.tx_status,
    type: payrollType,
    txType: isContractCall ? 'Contract Call' : 'Transfer',
    fee: `${(Number(tx.fee_rate) / 1_000_000).toLocaleString()} STX`,
    blockHeight: tx.block_height,
    nonce: tx.nonce,
    explorerLink: `https://explorer.stacks.co/txid/${tx.tx_id}?chain=testnet`, // Default to testnet
    txResult: tx.tx_result?.repr || tx.tx_result?.hex || undefined
  }
}

/**
 * Maps technical blockchain status strings to user-friendly labels.
 */
export function formatTxStatus(status: string) {
  if (!status) return "Unknown"
  const s = status.toLowerCase()
  if (s === 'success') return 'Success'
  if (s === 'pending') return 'Processing'
  if (s === 'abort_by_response' || s === 'abort_by_post_condition') return 'Declined'
  if (s.includes('abort') || s.includes('failed')) return 'Failed'
  // capitalize first letter if nothing else matches
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-card border rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 sm:p-8 pb-4 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{title}</CardTitle>
                {description && <CardDescription className="text-sm">{description}</CardDescription>}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full shrink-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 sm:pb-8 custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (!mounted) return null

  return createPortal(modalContent, document.body)
}

export function SendCryptoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currency, setCurrency] = React.useState<'STX' | 'BTC'>('STX')
  const { transferSTX, isConnected, connectWallet } = useStacks()
  const { showNotification } = useNotification()
  const [recipient, setRecipient] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSend = async () => {
    if (currency === 'BTC') {
        showNotification("info", "BTC Transfers coming soon", "Please use STX for now.")
        return
    }

    if (!isConnected) {
        connectWallet()
        return
    }

    if (!recipient || !amount) {
        showNotification("error", "Missing fields", "Please enter recipient and amount.")
        return
    }

    try {
        setIsSubmitting(true)
        await transferSTX(recipient, parseFloat(amount), (data: any) => {
             const txId = data.txId || ""
             showNotification('success', 'Transfer Broadcasted', `Tx ID: ${txId}`)
        })
        // Modal stays open until broadcast is confirmed or cancelled by the wallet
        onClose()
    } catch (e: any) {
        console.error("Transfer Error:", e)
        showNotification('error', 'Transfer Error', e.message || 'An unexpected error occurred.')
    } finally {
        setIsSubmitting(false)
    }
  }
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Send Crypto" 
      description="Transfer BTC or STX directly to another wallet address."
    >
      <div className="space-y-6">
        <div className="flex bg-accent/50 rounded-xl p-1">
          <Button 
            variant={currency === 'STX' ? 'default' : 'ghost'} 
            className="flex-1 rounded-lg h-10 font-bold"
            onClick={() => setCurrency('STX')}
          >
            STX
          </Button>
          <div className="relative flex-1">
            <Button 
              variant="ghost" 
              className="w-full rounded-lg h-10 font-bold"
              onClick={() => {
                showNotification('info', 'Coming Soon', 'Bitcoin payments will be available once sBTC launches. Stay tuned!')
              }}
            >
              BTC
            </Button>
            <div className="absolute -top-1 -right-1 pointer-events-none">
              <span className="text-[7px] font-black uppercase tracking-tight bg-orange-500 text-white px-1 py-0.5 rounded-full animate-pulse">
                Soon
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Recipient Address</Label>
            <Input 
                id="address" 
                placeholder={`Enter ${currency} address...`} 
                className="rounded-xl h-12"
                onChange={(e) => setRecipient(e.target.value)}
                value={recipient}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <Input 
                id="amount" 
                type="number" 
                placeholder="0.00" 
                className="rounded-xl h-12 pr-12 font-mono"
                onChange={(e) => setAmount(e.target.value)}
                value={amount} 
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">{currency}</span>
            </div>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex gap-3">
          <Info className="h-5 w-5 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Ensure the recipient address matches the selected network ({currency === 'STX' ? 'Stacks' : 'Bitcoin'}). Crypto transfers are final and cannot be reversed.
          </p>
        </div>

        <Button 
            className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 bg-primary group"
            onClick={handleSend}
            disabled={isSubmitting}
        >
          {isSubmitting ? (
             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
             <Send className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          )}
          {isConnected ? "Confirm & Send" : "Connect Wallet to Send"}
        </Button>
      </div>
    </Modal>
  )
}

export function AddTeamMemberModal({ isOpen, onClose, initialData }: { isOpen: boolean; onClose: () => void; initialData?: any }) {
  const [type, setType] = React.useState<'employee' | 'contractor'>('contractor')
  const [name, setName] = React.useState("")
  const [role, setRole] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [wallet, setWallet] = React.useState("")
  const [btcWallet, setBtcWallet] = React.useState("")
  const [rate, setRate] = React.useState("")
  const [frequency, setFrequency] = React.useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [duration, setDuration] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [stxPrice, setStxPrice] = React.useState(0)
  const { showNotification } = useNotification()
  const { getSTXPrice } = useStacks()

  React.useEffect(() => {
    if (initialData) {
      setName(initialData.name || "")
      setRole(initialData.role || "")
      setEmail(initialData.email || "")
      setWallet(initialData.wallet_address || "")
      setBtcWallet(initialData.btc_address || "")
      setRate(initialData.rate || "")
      setFrequency(initialData.payment_frequency || 'monthly')
      setStartDate(initialData.contract_start || "")
      setEndDate(initialData.contract_end || "")
      setDuration(initialData.contract_duration || "")
      setType(initialData.type || 'contractor')
    } else {
      setName("")
      setRole("")
      setEmail("")
      setWallet("")
      setBtcWallet("")
      setRate("")
      setFrequency('monthly')
      setStartDate("")
      setEndDate("")
      setDuration("")
      setType('contractor')
    }
  }, [initialData, isOpen])

  React.useEffect(() => {
    const fetchPrice = async () => {
      const price = await getSTXPrice()
      setStxPrice(price)
    }
    if (isOpen) fetchPrice()
  }, [isOpen, getSTXPrice])

  const handleOnboard = async () => {
    if (!name || !wallet) {
      showNotification('error', 'Missing fields', 'Name and Wallet Address are required.')
      return
    }

    setIsSubmitting(true)
    try {
      if (initialData) {
        const result = await updateTeamMember(initialData.id, {
          name,
          role,
          email,
          wallet_address: wallet,
          btc_address: btcWallet,
          rate,
          payment_frequency: frequency,
          contract_start: startDate || undefined,
          contract_end: endDate || undefined,
          contract_duration: duration,
          type
        })
        if (result.error) throw new Error(result.error)
        showNotification('success', 'Success', `${name} has been updated.`)
      } else {
        const result = await addTeamMember({
          name,
          role,
          email,
          wallet_address: wallet,
          btc_address: btcWallet,
          rate,
          payment_frequency: frequency,
          contract_start: startDate || undefined,
          contract_end: endDate || undefined,
          contract_duration: duration,
          type
        })
        if (result.error) throw new Error(result.error)
        showNotification('success', 'Success', `${name} has been onboarded.`)
      }
      onClose()
    } catch (e: any) {
      showNotification('error', 'Error', e.message || 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialData ? "Edit Recipient" : "Add Recipient"} 
      description={initialData ? "Update existing recipient details." : "Onboard a new employee or contractor as a payout recipient."}
    >
      <div className="space-y-4">
        <div className="flex bg-accent/50 rounded-xl p-1">
            <Button 
                variant={type === 'employee' ? 'default' : 'ghost'} 
                className="flex-1 rounded-lg h-9 text-sm font-semibold"
                onClick={() => setType('employee')}
            >
                Employee
            </Button>
            <Button 
                variant={type === 'contractor' ? 'default' : 'ghost'} 
                className="flex-1 rounded-lg h-9 text-sm font-semibold"
                onClick={() => setType('contractor')}
            >
                Contractor
            </Button>
        </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                    id="name" 
                    placeholder="Jane Doe" 
                    className="rounded-xl h-12" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="role">Role / Title</Label>
                <Input 
                    id="role" 
                    placeholder="Backend Developer" 
                    className="rounded-xl h-12" 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="stx-address">STX Address</Label>
                <Input 
                    id="stx-address" 
                    placeholder="SP..." 
                    className="rounded-xl h-12 font-mono" 
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="btc-address">BTC Address (Optional)</Label>
                <Input 
                    id="btc-address" 
                    placeholder="bc1..." 
                    className="rounded-xl h-12 font-mono" 
                    value={btcWallet}
                    onChange={(e) => setBtcWallet(e.target.value)}
                />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="rate">Monthly Rate (USD)</Label>
                    {stxPrice > 0 && rate && (
                        <span className="text-[10px] font-bold text-primary animate-pulse">
                            ≈ {(parseFloat(rate) / stxPrice).toFixed(2)} STX
                        </span>
                    )}
                </div>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                    <Input 
                        id="rate" 
                        placeholder="0.00" 
                        className="rounded-xl h-12 pl-8" 
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                    <SelectTrigger className="rounded-xl h-12">
                        <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>

            <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
            <Input 
                id="email" 
                type="email" 
                placeholder="jane@example.com" 
                className="rounded-xl h-12" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Contract Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input 
                        id="start-date" 
                        type="date" 
                        className="rounded-xl h-12" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input 
                        id="end-date" 
                        type="date" 
                        className="rounded-xl h-12" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
            </div>
            <div className="space-y-2 mt-4">
                <Label htmlFor="duration">Contract Duration (e.g. 2 Years)</Label>
                <Input 
                    id="duration" 
                    placeholder="2 Years" 
                    className="rounded-xl h-12" 
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                />
            </div>
          </div>
        <div className="pt-4 shrink-0">
          <Button 
              className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 bg-primary group"
              onClick={handleOnboard}
              disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            )}
            Onboard {type === 'employee' ? 'Employee' : 'Contractor'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function ReceiveCryptoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currency, setCurrency] = React.useState<'STX' | 'BTC'>('STX')
  const [copied, setCopied] = React.useState(false)
  
  const address = currency === 'STX' 
    ? "SP2J6ZY48GV1EZ5V2V5RB9MPJ43V86650KR5X4" 
    : "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"

  const { showNotification } = useNotification()

  const handleCopy = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    showNotification("success", "Address Copied", `Your ${currency} address is ready to share.`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Receive Crypto" 
      description="Share this QR code or address to receive payments."
    >
      <div className="space-y-8 flex flex-col items-center">
        
        <div className="flex bg-accent/50 rounded-xl p-1 w-full max-w-[200px] mb-2">
          <Button 
            variant={currency === 'STX' ? 'default' : 'ghost'} 
            className="flex-1 rounded-lg h-8 text-xs font-bold"
            onClick={() => setCurrency('STX')}
          >
            STX
          </Button>
          <div className="relative flex-1">
            <Button 
              variant="ghost" 
              className="w-full rounded-lg h-8 text-xs font-bold"
              onClick={() => {
                showNotification('info', 'Coming Soon', 'Bitcoin receiving will be available once sBTC launches. Stay tuned!')
              }}
            >
              BTC
            </Button>
            <div className="absolute -top-1 -right-1 pointer-events-none">
              <span className="text-[7px] font-black uppercase tracking-tight bg-orange-500 text-white px-1 py-0.5 rounded-full animate-pulse">
                Soon
              </span>
            </div>
          </div>
        </div>

        {/* QR Code Placeholder */}
        <div className="relative group">
          <div className="w-48 h-48 bg-white p-4 rounded-3xl shadow-sm border-4 border-dashed border-muted-foreground/20 flex items-center justify-center">
             <div className="grid grid-cols-6 grid-rows-6 gap-1 w-full h-full opacity-80">
                {/* Simulated QR Pattern */}
                {[...Array(36)].map((_, i) => (
                    <div key={i} className={`bg-black rounded-sm ${Math.random() > 0.5 ? 'opacity-0' : 'opacity-100'}`} />
                ))}
            </div>
             {/* Center Logo Overlay */}
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                    {currency === 'STX' ? (
                       <ArrowDownLeft className="h-6 w-6 text-primary" />
                    ) : (
                       <span className="font-bold text-lg text-orange-500">₿</span>
                    )}
                </div>
             </div>
          </div>
        </div>

        <div className="w-full space-y-4">
          <div className="text-center space-y-1">
             <p className="text-sm font-medium text-muted-foreground">Your {currency === 'STX' ? 'Stacks' : 'Bitcoin'} Address</p>
          </div>
          
          <div 
            className="flex items-center gap-2 p-1 pl-4 bg-secondary/50 rounded-2xl border border-border/50 group hover:border-primary/30 transition-colors cursor-pointer"
            onClick={handleCopy}
          >
            <p className="font-mono text-xs sm:text-sm truncate opacity-80 group-hover:opacity-100 transition-opacity">
              {address}
            </p>
            <Button 
                size="icon" 
                variant="ghost" 
                className={cn("rounded-xl ml-auto shrink-0", copied && "text-green-600")}
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className={cn(
            "rounded-xl p-4 text-xs text-center leading-relaxed",
            currency === 'STX' ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300" : "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300"
        )}>
            {currency === 'STX' ? (
                <>Only send <strong>STX</strong> or <strong>SIP-10</strong> tokens to this address.</>
            ) : (
                <>Only send <strong>Bitcoin (BTC)</strong> to this address.</>
            )}
             Sending other assets may result in permanent loss.
        </div>
      </div>
    </Modal>
  )
}

export function TransactionDetailsModal({ 
  isOpen, 
  onClose, 
  transaction 
}: { 
  isOpen: boolean
  onClose: () => void
  transaction: EnrichedTransaction | null 
}) {
  const { showNotification } = useNotification()

  if (!transaction) return null

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showNotification('success', 'Copied!', `${label} copied to clipboard`)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction Details"
      description="Complete metadata and audit trail for this transaction."
    >
      <div className="space-y-6">
        {/* Header Status & Amount */}
        <div className="flex flex-col items-center justify-center p-6 bg-accent/30 rounded-2xl border border-border/50">
           <div className={cn(
             "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-3",
             transaction.rawStatus === 'success' ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" : 
             transaction.rawStatus === 'pending' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400" :
             "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
           )}>
             {transaction.status}
           </div>
           <div className="text-3xl font-black tracking-tight">{transaction.amount}</div>
           {transaction.amountUSD && (
             <div className="text-sm font-bold text-muted-foreground mt-1">{transaction.amountUSD}</div>
           )}
        </div>

        {/* Key Details Grid */}
        <div className="grid gap-4 text-sm">
          
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors group">
            <span className="text-muted-foreground font-medium">Transaction ID</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{truncateAddress(transaction.txId, 6, 6)}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleCopy(transaction.txId, 'Tx ID')}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors">
            <span className="text-muted-foreground font-medium">Time</span>
            <span className="font-semibold">{transaction.date}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors">
            <span className="text-muted-foreground font-medium">Payroll Type</span>
            <span className="font-semibold">{transaction.type}</span>
          </div>
          
           <div className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors">
            <span className="text-muted-foreground font-medium">Transaction Type</span>
            <span className="font-semibold">{transaction.txType}</span>
          </div>

          <div className="space-y-1 p-3 rounded-xl hover:bg-accent/50 transition-colors">
             <div className="flex justify-between mb-1">
                <span className="text-muted-foreground font-medium">From (Sender)</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="font-bold">{transaction.senderName}</span>
                <div className="flex items-center gap-2">
                   <span className="font-mono text-xs text-muted-foreground">{truncateAddress(transaction.senderAddress)}</span>
                   <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleCopy(transaction.senderAddress, 'Sender Address')}>
                     <Copy className="h-3 w-3" />
                   </Button>
                </div>
             </div>
          </div>

          <div className="space-y-1 p-3 rounded-xl hover:bg-accent/50 transition-colors">
             <div className="flex justify-between mb-1">
                <span className="text-muted-foreground font-medium">To (Recipient)</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="font-bold">{transaction.recipientName}</span>
                <div className="flex items-center gap-2">
                   <span className="font-mono text-xs text-muted-foreground">{truncateAddress(transaction.recipientAddress)}</span>
                   <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleCopy(transaction.recipientAddress, 'Recipient Address')}>
                     <Copy className="h-3 w-3" />
                   </Button>
                </div>
             </div>
          </div>
        </div>

        {/* Technical Details Collapsible (Simplified as just list for now) */}
        <div className="border-t pt-4 space-y-2">
             <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">Technical Details</h4>
             <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-secondary/50 rounded-lg text-center">
                    <span className="block text-muted-foreground mb-1">Fee</span>
                    <span className="font-mono font-bold">{transaction.fee}</span>
                </div>
                <div className="p-2 bg-secondary/50 rounded-lg text-center">
                    <span className="block text-muted-foreground mb-1">Block</span>
                    <span className="font-mono font-bold">#{transaction.blockHeight}</span>
                </div>
                <div className="p-2 bg-secondary/50 rounded-lg text-center">
                    <span className="block text-muted-foreground mb-1">Nonce</span>
                    <span className="font-mono font-bold">{transaction.nonce}</span>
                </div>
             </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => window.open(transaction.explorerLink, '_blank')}>
                View Proof <ArrowDownLeft className="ml-2 h-4 w-4 rotate-180" />
            </Button>
            <Button className="flex-1" onClick={onClose}>
                Close
            </Button>
        </div>
      </div>
    </Modal>
  )
}
