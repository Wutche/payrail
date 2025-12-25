'use client'

import * as React from "react"
import { 
  X, 
  History as HistoryIcon, 
  Settings, 
  Mail, 
  Wallet, 
  Bitcoin, 
  Calendar,
  Clock,
  ArrowUpRight,
  ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/dashboard/ActionModals"
import { Card, CardContent } from "@/components/ui/card"
import { useStacks } from "@/hooks/useStacks"
import { cn } from "@/lib/utils"

interface RecipientDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  recipient: any
}

export function RecipientDetailsModal({ isOpen, onClose, recipient }: RecipientDetailsModalProps) {
  const { getRecentTransactions } = useStacks()
  const [history, setHistory] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    async function loadHistory() {
      if (recipient?.wallet_address && isOpen) {
        setIsLoading(true)
        try {
          const txs = await getRecentTransactions(recipient.wallet_address)
          setHistory(txs || [])
        } catch (e) {
          console.error("Error loading recipient history:", e)
        } finally {
          setIsLoading(false)
        }
      }
    }
    loadHistory()
  }, [recipient, isOpen, getRecentTransactions])

  if (!recipient) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recipient History"
      description={`Detailed record for ${recipient.name}`}
    >
      <div className="space-y-6">
        {/* Profile Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-accent/10 rounded-2xl border border-primary/5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Payouts</p>
            <p className="text-xl font-bold text-primary">${recipient.rate}</p>
          </div>
          <div className="p-4 bg-accent/10 rounded-2xl border border-primary/5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Frequency</p>
            <p className="text-xl font-bold capitalize">{recipient.payment_frequency}</p>
          </div>
        </div>

        {/* Schedule Info */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold">Next Scheduled Payout</p>
              <p className="text-[11px] text-muted-foreground">Automatically triggered every {recipient.payment_frequency}</p>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-primary/10">
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Onboarding Status</span>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-950/30 rounded-full text-[10px] font-bold uppercase">Active</span>
          </div>
        </div>

        {/* Transaction History */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-primary" />
            Recent Activity
          </h4>
          
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-accent/5 rounded-xl animate-pulse" />
              ))
            ) : history.length > 0 ? (
              history.map((tx) => (
                <div key={tx.tx_id} className="flex items-center justify-between p-3 bg-accent/5 rounded-xl hover:bg-accent/10 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center">
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold truncate max-w-[120px]">
                        {tx.tx_type === 'smart_contract' ? tx.contract_call?.function_name : 'STX Transfer'}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{new Date(tx.burn_block_time * 1000).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={`https://explorer.hiro.so/txid/${tx.tx_id}?chain=testnet`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center bg-accent/5 rounded-2xl border border-dashed">
                <p className="text-xs text-muted-foreground">No recent on-chain activity found.</p>
              </div>
            )}
          </div>
        </div>

        <Button className="w-full rounded-xl" variant="outline" onClick={onClose}>
          Close Details
        </Button>
      </div>
    </Modal>
  )
}
