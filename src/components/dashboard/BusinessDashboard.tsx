"use client";

import * as React from "react";
import { Send, Plus, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, Variants } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useMobileWallet } from "@/hooks/useMobileWallet";
import { SendCryptoModal, AddTeamMemberModal } from "./ActionModals";
import { BlockchainStats, RecentTransactionsList } from "./BusinessDashboardComponents";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 15 } },
};

function StatSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="border-none shadow-sm animate-pulse">
          <CardContent className="p-6 h-[140px] bg-accent/10 rounded-xl" />
        </Card>
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <Card className="lg:col-span-2 border-none shadow-sm animate-pulse">
      <CardHeader className="h-20 bg-accent/10 mb-4" />
      <CardContent className="h-64 bg-accent/5" />
    </Card>
  )
}

export function BusinessDashboard({ initialOrgName, initialRecipients = [] }: { initialOrgName?: string; initialRecipients?: any[] }) {
  const { user } = useAuth();
  const { isConnected, address, connect, getSTXPrice, MobileModal } = useMobileWallet();
  const supabase = React.useMemo(() => createClient(), []);
  
  const [storedWalletAddress, setStoredWalletAddress] = React.useState<string | null>(null);
  const [isMounted, setIsMounted] = React.useState(false)
  const [isSendModalOpen, setIsSendModalOpen] = React.useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [stxPrice, setStxPrice] = React.useState(0)

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
  const effectiveAddress = storedWalletAddress || (isConnected ? address : null)
  const hasWallet = !!effectiveAddress

  React.useEffect(() => {
    setIsMounted(true)
    const fetchPrice = async () => {
        const price = await getSTXPrice()
        setStxPrice(price)
    }
    fetchPrice()
  }, [getSTXPrice])

  const totalMonthlyUSD = initialRecipients.reduce((acc, curr) => acc + (parseFloat(curr.rate) || 0), 0)
  const estimatedSTX = stxPrice > 0 ? (totalMonthlyUSD / stxPrice).toFixed(2) : "0"

  return (
    <React.Fragment>
      <motion.div
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="flex flex-col md:flex-row md:items-center justify-between gap-6"
          variants={itemVariants}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight whitespace-nowrap">Organization Overview</h1>
              {isMounted && (
                <span className={cn(
                  "text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0",
                  hasWallet ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {hasWallet ? <ShieldCheck className="h-2.5 w-2.5 sm:h-3 w-3" /> : <Clock className="h-2.5 w-2.5 sm:h-3 w-3" />}
                  {hasWallet ? "On-Chain Verified" : "Wallet Not Connected"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
              <span className="text-xs sm:text-sm font-medium">{initialOrgName || user?.user_metadata?.organization || "My Organization"}</span>
              <span className="text-xs opacity-50">•</span>
              {!isMounted ? (
                <div className="h-4 w-20 sm:h-5 w-24 bg-accent/50 animate-pulse rounded-lg" />
              ) : (
              <code className="text-[10px] sm:text-xs bg-accent/50 px-1.5 sm:px-2 py-0.5 rounded-lg border border-border/50 font-mono">
                  {hasWallet && effectiveAddress ? `${effectiveAddress.substring(0, 5)}...${effectiveAddress.substring(effectiveAddress.length - 4)}` : "----"}
                </code>
              )}
            </div>
          </div>
          {isMounted && (
            <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto flex-wrap">
              {!hasWallet && (
                <Button onClick={connect} variant="outline" className="flex-1 md:flex-none rounded-xl border-primary text-primary text-xs sm:text-sm h-10">
                  Connect Wallet
                </Button>
              )}
              <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 md:flex-none rounded-xl h-10 px-4 sm:px-6 font-semibold text-xs sm:text-sm whitespace-nowrap"
                  onClick={() => setIsSendModalOpen(true)}
              >
                <Send className="mr-2 h-3.5 w-3.5 sm:h-4 w-4" />
                Transfer
              </Button>
              <Button 
                  size="sm" 
                  className="flex-1 md:flex-none rounded-xl h-10 px-4 sm:px-6 font-bold shadow-lg shadow-primary/20 text-xs sm:text-sm whitespace-nowrap"
                  onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="mr-2 h-3.5 w-3.5 sm:h-4 w-4" />
                Add Recipient
              </Button>
            </div>
          )}
        </motion.div>

        {/* Stats Grid - Wrapped in Suspense if we had a data-fetching parent, but for now we use skeletons in Client */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isMounted && hasWallet && effectiveAddress ? (
                <BlockchainStats 
                  address={effectiveAddress} 
                  memberCount={initialRecipients.length} 
                  pendingCount={initialRecipients.filter((r: any) => !r.wallet_address).length}
                />
            ) : (
              [1, 2, 3, 4].map(i => (
                <Card key={i} className="border-none shadow-sm opacity-50">
                  <CardContent className="p-6 h-[140px] flex items-center justify-center italic text-xs text-muted-foreground">
                    Connect wallet to view
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </motion.div>

        {/* Tables/Lists */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          variants={itemVariants}
        >
          {isMounted && hasWallet && effectiveAddress ? (
              <RecentTransactionsList address={effectiveAddress} />
          ) : (
            <Card className="lg:col-span-2 border-none shadow-sm h-64 flex items-center justify-center italic text-muted-foreground">
              Recent transactions will appear here after connection.
            </Card>
          )}

          <div className="space-y-8">
            <Card className="border-none shadow-sm bg-primary text-primary-foreground overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Run Payroll</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Batch pay your entire team with one transaction.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-white/10 rounded-xl space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-80">Total Due</span>
                    <span className="text-xl font-bold">{estimatedSTX} STX</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-80">Estimated Fiat</span>
                    <span className="text-sm font-medium">~${totalMonthlyUSD.toLocaleString()}</span>
                  </div>
                </div>
                <Link href="/dashboard/payroll/create" className="block">
                  <Button
                    variant="secondary"
                    className="w-full h-12 rounded-xl text-primary font-bold shadow-lg"
                  >
                    Execute Batch Payment
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Top Performers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {initialRecipients.length > 0 ? (
                  initialRecipients
                    .slice(0, 3)
                    .sort((a: any, b: any) => (parseFloat(b.rate) || 0) - (parseFloat(a.rate) || 0))
                    .map((recipient: any, i: number) => (
                      <div key={recipient.id} className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          i === 0 ? "bg-amber-500/10 text-amber-500" :
                          i === 1 ? "bg-slate-400/10 text-slate-400" :
                          "bg-orange-700/10 text-orange-700"
                        )}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground">{recipient.role || 'Team Member'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">${parseFloat(recipient.rate || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">per month</p>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm italic">
                    Add team members to see data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </motion.div>

      <SendCryptoModal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} />
      <AddTeamMemberModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <MobileModal />
    </React.Fragment>
  );
}
