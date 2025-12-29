'use client'

import * as React from "react"
import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ExternalLink,
  Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { DataTable } from "@/components/dashboard/DataTable"
import { formatTxStatus, TransactionDetailsModal, enrichTransaction, type EnrichedTransaction, truncateAddress } from "./ActionModals"
import { getTeamMembers, getTeamProfile } from "@/app/actions/team"
import { Eye } from "lucide-react"

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
  const [activeTab, setActiveTab] = React.useState<'all' | 'sent' | 'received'>('all')
  const { address, getRecentTransactions, isTestnet, getBusinessInfo, getSTXPrice } = useStacks()
  const [txs, setTxs] = React.useState<EnrichedTransaction[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isMounted, setIsMounted] = React.useState(false)
  const [selectedTx, setSelectedTx] = React.useState<EnrichedTransaction | null>(null)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  React.useEffect(() => {
    async function load() {
        if (address) {
            setIsLoading(true)
            try {
                const [rawTxs, { data: members }, { data: profile }, businessInfo, price] = await Promise.all([
                    getRecentTransactions(address),
                    getTeamMembers(),
                    getTeamProfile(),
                    getBusinessInfo(address),
                    getSTXPrice()
                ]);
                
                const orgName = profile?.organization_name || profile?.full_name || "My Business";

                const enriched = (rawTxs || []).map((tx: any) => enrichTransaction(tx, members || [], orgName, address, price));
                setTxs(enriched)
            } catch (e) {
                console.error("Failed to load history", e)
            } finally {
                setIsLoading(false)
            }
        }
    }
    load()
  }, [address, getRecentTransactions, getBusinessInfo, getSTXPrice])

  // Filter for display
  const transactions = txs.filter(t => {
      if (activeTab === 'all') return true
      if (activeTab === 'sent') return t.senderAddress === address
      if (activeTab === 'received') return t.recipientAddress === address // Simplification, logic inside enrich handles roles
      return true
  })

  if (!isMounted) return null

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
                        tx.senderAddress === address ? "" : "text-green-600"
                      )}>
                        {tx.senderAddress === address ? '-' : '+'}{tx.amount}
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
