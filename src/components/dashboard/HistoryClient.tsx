'use client'

import * as React from "react"
import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ExternalLink,
  Download,
  Wallet
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { DataTable } from "@/components/dashboard/DataTable"
import { formatTxStatus, TransactionDetailsModal, enrichTransaction, type EnrichedTransaction, truncateAddress } from "./ActionModals"
import { getTeamMembers, getTeamProfile } from "@/app/actions/team"
import { Eye } from "lucide-react"
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

export function HistoryClient({ initialTransactions = [] }: { initialTransactions?: any[] }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = React.useState<'all' | 'sent' | 'received'>('all')
  const { address: connectedAddress, isConnected, getRecentTransactions, isTestnet, getBusinessInfo, getSTXPrice, getTransactionEvents } = useStacks()
  const supabase = React.useMemo(() => createClient(), [])
  
  const [storedWalletAddress, setStoredWalletAddress] = React.useState<string | null>(null)
  const [txs, setTxs] = React.useState<EnrichedTransaction[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isMounted, setIsMounted] = React.useState(false)
  const [selectedTx, setSelectedTx] = React.useState<EnrichedTransaction | null>(null)

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
  // For business users, show their transactions even if wallet isn't synced to profile yet
  const effectiveAddress = storedWalletAddress || (isConnected ? connectedAddress : null)
  const hasWallet = !!effectiveAddress

  React.useEffect(() => {
    async function load() {
        if (hasWallet && effectiveAddress) {
            setIsLoading(true)
            try {
                const [rawTxs, { data: members }, { data: profile }, businessInfo, price] = await Promise.all([
                    getRecentTransactions(effectiveAddress),
                    getTeamMembers(),
                    getTeamProfile(),
                    getBusinessInfo(effectiveAddress),
                    getSTXPrice()
                ]);
                
                const orgName = profile?.organization_name || profile?.full_name || "My Business";

                // Process transactions and expand batch payrolls
                const expandedTxs: EnrichedTransaction[] = [];
                
                for (const tx of (rawTxs || [])) {
                    // Check if this is a batch payroll contract call
                    const isBatchPayroll = tx.tx_type === 'contract_call' && 
                        tx.contract_call?.function_name === 'execute-batch-payroll';
                    
                    if (isBatchPayroll && tx.tx_id && tx.tx_status === 'success') {
                        // Fetch the actual STX transfers from this batch payroll
                        const events = await getTransactionEvents(tx.tx_id);
                        
                        if (events && events.stxTransfers && events.stxTransfers.length > 0) {
                            // Create a virtual transaction for each recipient
                            for (const transfer of events.stxTransfers) {
                                // Find the team member name for this recipient
                                const member = members?.find((m: any) => 
                                    m.wallet_address?.toLowerCase() === transfer.recipient?.toLowerCase()
                                );
                                
                                const virtualTx = {
                                    ...tx,
                                    // Override with actual transfer data
                                    sender_address: transfer.sender,
                                    token_transfer: {
                                        recipient_address: transfer.recipient,
                                        amount: transfer.amount * 1_000_000, // Convert back to uSTX for enrichTransaction
                                    },
                                    stx_sent: transfer.amount * 1_000_000,
                                    // Add a virtual ID to make each row unique
                                    tx_id: `${tx.tx_id}-${transfer.recipient}`,
                                    _parentTxId: tx.tx_id, // Keep reference to original
                                    _batchRecipientName: member?.name,
                                };
                                
                                expandedTxs.push(enrichTransaction(virtualTx, members || [], orgName, effectiveAddress, price));
                            }
                        } else {
                            // If no events found, still show the parent transaction
                            expandedTxs.push(enrichTransaction(tx, members || [], orgName, effectiveAddress, price));
                        }
                    } else {
                        // Regular transaction
                        expandedTxs.push(enrichTransaction(tx, members || [], orgName, effectiveAddress, price));
                    }
                }
                
                setTxs(expandedTxs);
            } catch (e) {
                console.error("Failed to load history", e)
            } finally {
                setIsLoading(false)
            }
        } else {
            setTxs([])
            setIsLoading(false)
        }
    }
    load()
  }, [hasWallet, effectiveAddress, getRecentTransactions, getBusinessInfo, getSTXPrice, getTransactionEvents])

  // Filter for display
  const transactions = txs.filter(t => {
      if (activeTab === 'all') return true
      if (activeTab === 'sent') return t.senderAddress === effectiveAddress
      if (activeTab === 'received') return t.recipientAddress === effectiveAddress
      return true
  })

  if (!isMounted) return null

  // Show not connected state
  if (!hasWallet) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
          <p className="text-muted-foreground mt-1">A complete record of all your Bitcoin & STX transfers.</p>
        </div>
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Wallet Connected</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Connect your Stacks wallet to view your transaction history.
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
          <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
          <p className="text-muted-foreground mt-1">A complete record of all your Bitcoin & STX transfers.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="rounded-xl">
             <Download className="mr-2 h-4 w-4" />
             Download CSV
           </Button>
        </div>
      </motion.div>

      <motion.div className="flex items-center gap-1 p-1 bg-accent/20 rounded-2xl w-fit" variants={itemVariants}>
        {['all', 'sent', 'received'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all",
              activeTab === tab ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-6">
             <CardTitle className="text-lg">All Transactions</CardTitle>
             <CardDescription>Filtering by: {activeTab}</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable 
              data={transactions}
              pageSize={10}
              columns={[
                {
                  header: "Tx ID",
                  accessorKey: (tx: EnrichedTransaction) => <span className="font-mono text-[10px] md:text-xs text-muted-foreground">{truncateAddress(tx.txId)}</span>
                },
                {
                  header: "Organization",
                  className: "hidden md:table-cell",
                  accessorKey: (tx: EnrichedTransaction) => (
                    <div className="flex flex-col">
                        <span className="font-semibold">{tx.senderName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{truncateAddress(tx.senderAddress)}</span>
                    </div>
                  )
                },
                {
                  header: "Recipient",
                  accessorKey: (tx: EnrichedTransaction) => (
                    <div className="flex flex-col">
                        <span className="font-semibold text-[10px] md:text-sm truncate max-w-[80px] md:max-w-none">{tx.recipientName}</span>
                        <span className="hidden md:inline text-[10px] text-muted-foreground font-mono">{truncateAddress(tx.recipientAddress)}</span>
                    </div>
                  )
                },
                {
                  header: "Status",
                  accessorKey: (tx: EnrichedTransaction) => (
                    <span className={cn(
                      "px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-wider",
                      tx.rawStatus === 'success' ? "bg-green-100 text-green-700 dark:bg-green-950/30" :
                      tx.rawStatus === 'pending' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30" :
                      "bg-red-100 text-red-700 dark:bg-red-950/30"
                    )}>
                      {tx.status}
                    </span>
                  )
                },
                {
                  header: "Amount",
                  accessorKey: (tx: EnrichedTransaction) => (
                    <div className="flex flex-col items-end md:items-start">
                      <span className={cn(
                        "font-mono font-bold text-[10px] md:text-sm",
                        tx.senderAddress === connectedAddress ? "" : "text-green-600"
                      )}>
                        {tx.senderAddress === connectedAddress ? '-' : '+'}{tx.amount}
                      </span>
                      {tx.amountUSD && (
                        <span className="block text-[8px] md:text-[10px] text-muted-foreground font-medium">
                          ≈ {tx.amountUSD}
                        </span>
                      )}
                    </div>
                  )
                },
                {
                  header: "Date",
                  className: "hidden lg:table-cell",
                  accessorKey: "date"
                },
                {
                  header: "",
                  className: "text-right",
                  accessorKey: (tx: EnrichedTransaction) => (
                    <div className="flex justify-end gap-1 md:gap-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 hidden sm:inline-flex" onClick={() => window.open(tx.explorerLink, '_blank')}>
                            <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-primary" onClick={() => setSelectedTx(tx)}>
                            <Eye className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </Button>
                    </div>
                  )
                }
              ]}
            />
          </CardContent>
        </Card>
      </motion.div>
      <TransactionDetailsModal 
        isOpen={!!selectedTx} 
        onClose={() => setSelectedTx(null)} 
        transaction={selectedTx} 
      />
    </motion.div>
  )
}
