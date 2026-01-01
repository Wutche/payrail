"use client";

import * as React from "react";
import { Send, Wallet, CheckCircle2, Users, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useStacks } from "@/hooks/useStacks";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { formatTxStatus, TransactionDetailsModal, enrichTransaction, type EnrichedTransaction, truncateAddress } from "./ActionModals";
import { getTeamMembers, getTeamProfile } from "@/app/actions/team";

// Skeleton for the stats
function StatSkeleton() {
  return (
    <Card className="border-none shadow-sm animate-pulse">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-10 w-10 rounded-lg bg-accent/50" />
          <div className="h-4 w-12 bg-accent/30 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-accent/30 rounded" />
          <div className="h-8 w-20 bg-accent/50 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// Sub-component for Blockchain Stats
export function BlockchainStats({ address, memberCount = 0, pendingCount = 0 }: { address: string; memberCount?: number; pendingCount?: number }) {
  const { getBusinessInfo, getSTXBalance, getRecentTransactions, getSTXPrice } = useStacks();
  const [data, setData] = React.useState<{
    balance: number | null;
    usdBalance: number | null;
    status: string;
    paid: number;
    paidUsd: number;
    stxPrice: number;
  }>({ balance: null, usdBalance: null, status: "Checking...", paid: 0, paidUsd: 0, stxPrice: 0 });

  React.useEffect(() => {
    const fetch = async () => {
      if (!address) return;
      try {
        const [statusData, stxBalance, txData, price] = await Promise.all([
          getBusinessInfo(address),
          getSTXBalance(address),
          getRecentTransactions(address),
          getSTXPrice()
        ]);

        // Filter to only count payroll-related payments (not registration fees)
        const contractName = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'payrail'
        const paymentFunctions = ['execute-payroll', 'execute-batch-payroll']
        
        const totalPaid = (txData || [])
          .filter((tx: any) => {
            if (tx.tx_status !== 'success') return false
            if (tx.sender_address !== address) return false
            
            // Count STX token transfers (one-time payments)
            if (tx.tx_type === 'token_transfer') return true
            
            // Count execute-payroll and execute-batch-payroll contract calls
            if (tx.tx_type === 'contract_call' && tx.contract_call?.contract_id) {
              const isPayrailContract = tx.contract_call.contract_id.includes(contractName) ||
                                       tx.contract_call.contract_id.includes('payrail-v')
              const isPaymentFunction = paymentFunctions.includes(tx.contract_call.function_name)
              return isPayrailContract && isPaymentFunction
            }
            return false
          })
          .reduce((acc: number, tx: any) => {
             const amt = tx.stx_sent || tx.token_transfer?.amount || 0;
             return acc + (Number(amt) / 1_000_000);
          }, 0);

        setData({
          balance: stxBalance,
          usdBalance: stxBalance !== null ? stxBalance * price : null,
          status: statusData?.isRegistered ? "Registered" : "Unregistered",
          paid: totalPaid,
          paidUsd: totalPaid * price,
          stxPrice: price
        });
      } catch (e) {
        console.error(e);
      }
    };
    fetch();

    // Polling for real-time updates every 15 seconds
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, [address, getBusinessInfo, getSTXBalance, getRecentTransactions, getSTXPrice]);

  // Determine Active Team badge based on pending count
  const activeTeamBadge = pendingCount > 0 
    ? `${pendingCount} PENDING ONBOARDING` 
    : (memberCount > 0 ? `${memberCount} REGISTERED` : "NO MEMBERS");
  const activeTeamBadgeColor = pendingCount > 0 ? "text-orange-500" : "text-emerald-500";
  const activeTeamBadgeBg = pendingCount > 0 ? "bg-orange-500/10" : "bg-emerald-500/10";

  const stats = [
    { 
      title: "Total Paid (On-Chain)", 
      value: `${data.paid.toLocaleString()} STX`, 
      subValue: data.stxPrice > 0 ? `≈ $${data.paidUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
      badge: "TOTAL PAYROLL", 
      badgeColor: "text-emerald-500", 
      badgeBg: "bg-emerald-500/10",
      icon: Send, 
      color: "text-orange-500 bg-orange-500/10" 
    },
    { 
      title: "Active Team", 
      value: memberCount.toString(), 
      subValue: null,
      badge: activeTeamBadge,
      badgeColor: activeTeamBadgeColor,
      badgeBg: activeTeamBadgeBg,
      icon: Users, 
      color: "text-blue-500 bg-blue-500/10" 
    },
    { 
      title: "Wallet Balance", 
      value: data.balance !== null ? `${data.balance.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} STX` : "----", 
      subValue: data.usdBalance !== null && data.stxPrice > 0 ? `≈ $${data.usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
      badge: "AVAILABLE FUNDS",
      badgeColor: "text-emerald-500",
      badgeBg: "bg-emerald-500/10",
      icon: Wallet, 
      color: "text-purple-500 bg-purple-500/10" 
    },
    { 
      title: "Status", 
      value: data.status, 
      subValue: null,
      badge: "BUSINESS ROLE",
      badgeColor: "text-emerald-500",
      badgeBg: "bg-emerald-500/10",
      icon: CheckCircle2, 
      color: "text-green-500 bg-green-500/10" 
    },
  ];

  return (
    <>
      {stats.map((stat, i) => (
        <Card key={i} className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full", stat.badgeBg, stat.badgeColor)}>
                {stat.badge}
              </span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
              <h3 className="text-2xl font-bold mt-1 tracking-tight">{stat.value}</h3>
              {stat.subValue && (
                <p className="text-sm text-primary font-semibold mt-0.5">{stat.subValue}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// Sub-component for Recent Transactions
export function RecentTransactionsList({ address }: { address: string }) {
  const { getRecentTransactions, isTestnet, getBusinessInfo, getSTXPrice } = useStacks();
  const [txs, setTxs] = React.useState<EnrichedTransaction[]>([]);
  const [page, setPage] = React.useState(1);
  const [selectedTx, setSelectedTx] = React.useState<EnrichedTransaction | null>(null);
  const itemsPerPage = 3;

  React.useEffect(() => {
    const fetchTransactions = async () => {
      if (!address) return;
      try {
          const [rawTxs, { data: members }, { data: profile }, businessInfo, price] = await Promise.all([
            getRecentTransactions(address),
            getTeamMembers(),
            getTeamProfile(),
            getBusinessInfo(address),
            getSTXPrice()
          ]);
          
          const orgName = profile?.organization_name || profile?.full_name || "My Business";

          // Filter to only show Payrail-related transactions
          const contractName = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'payrail'
          const payrailFunctions = ['register-business', 'create-organization', 'execute-payroll', 'execute-batch-payroll']
          
          const filteredTxs = (rawTxs || []).filter((tx: any) => {
            // Include contract calls to our payrail contract
            if (tx.tx_type === 'contract_call' && tx.contract_call?.contract_id) {
              const isPayrailContract = tx.contract_call.contract_id.includes(contractName) ||
                                       tx.contract_call.contract_id.includes('payrail-v')
              const isPayrailFunction = payrailFunctions.includes(tx.contract_call.function_name)
              return isPayrailContract && isPayrailFunction
            }
            // Include STX transfers we sent (one-time payments)
            if (tx.tx_type === 'token_transfer' && tx.sender_address === address) {
              return true
            }
            return false
          })

          const enriched = filteredTxs.map((tx: any) => enrichTransaction(tx, members || [], orgName, address, price));
          setTxs(enriched);
      } catch (e) {
        console.error("Error fetching txs", e);
      }
    };
    fetchTransactions();

    // Polling for real-time updates every 15 seconds (matches BlockchainStats)
    const interval = setInterval(fetchTransactions, 15000);
    return () => clearInterval(interval);
  }, [address, getRecentTransactions, getBusinessInfo, getSTXPrice]);

  const currentTxs = txs.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(txs.length / itemsPerPage);

  return (
    <>
    <Card className="lg:col-span-2 border-none shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <CardDescription>Latest STX payroll activities</CardDescription>
        </div>
        <Link href="/dashboard/history">
          <Button variant="ghost" size="sm" className="text-xs">View All</Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground font-medium">
                <th className="pb-3 text-left">Recipient</th>
                <th className="pb-3 text-left">Status</th>
                <th className="pb-3 text-left">Amount</th>
                <th className="pb-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {currentTxs.length > 0 ? currentTxs.map((tx, i) => {
                // Get initials from recipient name
                const initials = tx.recipientName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()
                
                // Format date as relative time
                const txDate = new Date(tx.timestamp || Date.now())
                const now = new Date()
                const diffMs = now.getTime() - txDate.getTime()
                const diffMins = Math.floor(diffMs / 60000)
                const diffHours = Math.floor(diffMs / 3600000)
                const diffDays = Math.floor(diffMs / 86400000)
                
                let timeAgo = 'Just now'
                if (diffDays > 0) timeAgo = diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`
                else if (diffHours > 0) timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
                else if (diffMins > 0) timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
                
                return (
                  <tr key={i} className="hover:bg-accent/30 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
                          {initials}
                        </div>
                        <span className="font-semibold">{tx.recipientName}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full",
                        tx.rawStatus === "success" ? "text-emerald-500 bg-emerald-500/10" : 
                        tx.rawStatus === "pending" ? "text-orange-500 bg-orange-500/10" :
                        "text-red-500 bg-red-500/10"
                      )}>
                        {tx.rawStatus === "success" ? "COMPLETED" : tx.rawStatus === "pending" ? "PENDING" : "FAILED"}
                      </span>
                    </td>
                    <td className="py-4 font-mono font-bold text-primary">
                      {tx.amount}
                    </td>
                    <td className="py-4 text-right text-muted-foreground text-sm">
                      {timeAgo}
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground italic">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages || 1}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    <TransactionDetailsModal 
        isOpen={!!selectedTx} 
        onClose={() => setSelectedTx(null)} 
        transaction={selectedTx} 
    />
    </>
  );
}
