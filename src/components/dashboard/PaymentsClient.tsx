'use client'

import * as React from "react"
import { 
  Wallet, 
  ArrowDownLeft, 
  Download,
  Calendar,
  Building2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { DataTable } from "@/components/dashboard/DataTable"
import { useAuth } from "@/hooks/useAuth"
import { createClient } from "@/lib/supabase"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 }
  }
}

import { useStacks } from "@/hooks/useStacks"

export function PaymentsClient({ initialTransactions = [] }: { initialTransactions?: any[] }) {
  const { user } = useAuth()
  const { address: connectedAddress, isConnected, getRecentTransactions, getSTXPrice, getBTCPrice } = useStacks()
  const supabase = React.useMemo(() => createClient(), [])
  
  const [storedWalletAddress, setStoredWalletAddress] = React.useState<string | null>(null)
  const [txs, setTxs] = React.useState<any[]>(initialTransactions)
  const [stxPrice, setStxPrice] = React.useState(0)
  const [btcPrice, setBtcPrice] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(txs.length === 0)
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  // Fetch user's stored wallet address from their profile
  React.useEffect(() => {
    async function fetchStoredWallet() {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single()
        
        setStoredWalletAddress(profile?.wallet_address || null)
      }
    }
    fetchStoredWallet()
  }, [user, supabase])

  // Use connected wallet address - either stored or currently connected
  const effectiveAddress = storedWalletAddress || (isConnected ? connectedAddress : null)
  const hasWallet = !!effectiveAddress

  React.useEffect(() => {
    async function load() {
        if (hasWallet && effectiveAddress) {
            setIsLoading(true)
            const [data, sPrice, bPrice] = await Promise.all([
                getRecentTransactions(effectiveAddress),
                getSTXPrice(),
                getBTCPrice()
            ])
            setTxs(data || [])
            setStxPrice(sPrice)
            setBtcPrice(bPrice)
            setIsLoading(false)
        } else {
            setTxs([])
            setIsLoading(false)
        }
    }
    if (txs.length === 0 || hasWallet) load()
  }, [hasWallet, effectiveAddress, getRecentTransactions, getSTXPrice, getBTCPrice])

  // Filter for incoming payments (received)
  const incomingTransactions = txs.filter(tx => tx.sender_address !== effectiveAddress)

  const incomingPayments = incomingTransactions.map(tx => {
    const amountSTX = Number(tx.stx_received || tx.token_transfer?.amount || 0) / 1_000_000
    return {
      id: tx.tx_id,
      from: tx.sender_address.substring(0, 10) + '...',
      project: tx.tx_type === 'smart_contract' ? (tx.contract_call?.function_name || 'Payment') : 'Transfer',
      amount: `${amountSTX.toLocaleString()} STX`,
      date: new Date(tx.burn_block_time * 1000).toLocaleDateString(),
      status: tx.tx_status === 'success' ? 'Success' : 'Pending',
      fiat: `~$${(amountSTX * stxPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  })

  const totalRevenueSTX = incomingTransactions.reduce((acc, tx) => acc + (Number(tx.stx_received || tx.token_transfer?.amount || 0) / 1_000_000), 0)

  if (!isMounted) return null

  // Show not connected state
  if (!hasWallet) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Incoming Payments</h1>
          <p className="text-muted-foreground mt-1">Detailed record of Bitcoin & STX received for your services.</p>
        </div>
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Wallet Connected</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Connect your Stacks wallet to view your payment history.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="flex flex-col md:flex-row md:items-center justify-between gap-4" variants={itemVariants}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Incoming Payments</h1>
          <p className="text-muted-foreground mt-1">Detailed record of Bitcoin & STX received for your services.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="rounded-xl">
             <Download className="mr-2 h-4 w-4" />
             Earnings Report
           </Button>
        </div>
      </motion.div>

       {/* Stats Grid */}
       <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" variants={itemVariants}>
         {[
           { title: "Total Revenue", value: `${totalRevenueSTX.toLocaleString()} STX`, sub: "All time", icon: Wallet, color: "text-green-600 bg-green-100 dark:bg-green-950/30" },
           { title: "Avg. Payment", value: `${(incomingPayments.length > 0 ? totalRevenueSTX / incomingPayments.length : 0).toFixed(2)} STX`, sub: "Per project", icon: ArrowDownLeft, color: "text-blue-600 bg-blue-100 dark:bg-blue-950/30" },
           { title: "Total USD", value: `$${(totalRevenueSTX * stxPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "Market value", icon: Building2, color: "text-purple-600 bg-purple-100 dark:bg-purple-950/30" },
           { title: "Payments", value: incomingPayments.length.toString(), sub: "Total count", icon: Calendar, color: "text-orange-600 bg-orange-100 dark:bg-orange-950/30" },
         ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className={cn("p-2.5 rounded-xl w-fit mb-4", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.title}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-extrabold tracking-tight">{stat.value}</h3>
                  <span className="text-[10px] text-muted-foreground">{stat.sub}</span>
                </div>
              </div>
            </CardContent>
          </Card>
         ))}
       </motion.div>

       <motion.div variants={itemVariants}>
        <Card className="border-none shadow-sm h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <div>
              <CardTitle className="text-lg">Recent Earnings</CardTitle>
              <CardDescription>Verified blockchain payments</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable 
              data={incomingPayments}
              pageSize={5}
              columns={[
                {
                  header: "Sender",
                  accessorKey: (p: any) => (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center font-bold text-[10px]">
                        {p.from.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <span className="font-semibold group-hover:text-primary transition-colors">{p.from}</span>
                    </div>
                  )
                },
                {
                  header: "Reference",
                  accessorKey: (p: any) => <span className="text-muted-foreground">{p.project}</span>
                },
                {
                  header: "Status",
                  accessorKey: (p: any) => (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-950/30">
                      {p.status}
                    </span>
                  )
                },
                {
                  header: "Amount",
                  accessorKey: (p: any) => <span className="font-mono font-bold text-green-600">+{p.amount}</span>
                },
                {
                  header: "Fiat Estimate",
                  className: "text-right",
                  accessorKey: (p: any) => <span className="font-medium opacity-60 italic">{p.fiat}</span>
                }
              ]}
            />
          </CardContent>
        </Card>
       </motion.div>
    </motion.div>
  )
}
