"use client";

import * as React from "react";
import { Wallet, ArrowDownLeft, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase";

// Sub-component for Earnings Stats
import { useStacks } from "@/hooks/useStacks";

export function FreelancerEarningsStats() {
  const { user } = useAuth();
  const { address: connectedAddress, isConnected, getSTXBalance, getRecentTransactions } = useStacks();
  const supabase = React.useMemo(() => createClient(), []);
  
  const [storedWalletAddress, setStoredWalletAddress] = React.useState<string | null>(null);
  const [balance, setBalance] = React.useState(0);
  const [lastPayment, setLastPayment] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch user's stored wallet address from their profile
  React.useEffect(() => {
    async function fetchStoredWallet() {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single();
        
        setStoredWalletAddress(profile?.wallet_address || null);
      }
    }
    fetchStoredWallet();
  }, [user, supabase]);

  // Check if the connected wallet matches the user's stored wallet
  const isUserWalletConnected = isConnected && 
    storedWalletAddress && 
    connectedAddress === storedWalletAddress;

  React.useEffect(() => {
    async function load() {
      // Only load data if connected wallet matches user's stored wallet
      if (isUserWalletConnected && connectedAddress) {
        setIsLoading(true);
        const [stxBal, txs] = await Promise.all([
          getSTXBalance(connectedAddress),
          getRecentTransactions(connectedAddress)
        ]);
        setBalance(stxBal);
        
        // Find last received payment
        const lastReceived = txs?.find((tx: any) => tx.sender_address !== connectedAddress);
        if (lastReceived) {
          const amount = Number(lastReceived.stx_received || lastReceived.token_transfer?.amount || 0) / 1_000_000;
          setLastPayment(amount);
        }
        setIsLoading(false);
      } else {
        // No wallet connected or doesn't match - reset to defaults
        setBalance(0);
        setLastPayment(0);
        setIsLoading(false);
      }
    }
    load();
  }, [isUserWalletConnected, connectedAddress, getSTXBalance, getRecentTransactions]);

  const stats = [
    { 
      title: "Current Balance", 
      value: isUserWalletConnected ? `${balance.toLocaleString()} STX` : "0 STX", 
      icon: Wallet, 
      color: isUserWalletConnected ? "text-green-600 bg-green-100" : "text-muted-foreground bg-muted" 
    },
    { 
      title: "Last Payment", 
      value: isUserWalletConnected ? `${lastPayment.toLocaleString()} STX` : "0 STX", 
      icon: ArrowDownLeft, 
      color: isUserWalletConnected ? "text-blue-600 bg-blue-100" : "text-muted-foreground bg-muted" 
    },
    { 
      title: "Status", 
      value: isUserWalletConnected ? "Active" : "Not Connected", 
      icon: Clock, 
      color: isUserWalletConnected ? "text-orange-600 bg-orange-100" : "text-muted-foreground bg-muted" 
    },
  ];

  return (
    <>
      {stats.map((stat, i) => (
        <Card key={i} className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl", stat.color)}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                <h3 className="text-2xl font-bold mt-0.5 tracking-tight">{stat.value}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// Sub-component for Recent Earnings List
export function RecentEarningsList() {
  const { user } = useAuth();
  const { address: connectedAddress, isConnected, getRecentTransactions } = useStacks();
  const supabase = React.useMemo(() => createClient(), []);
  
  const [storedWalletAddress, setStoredWalletAddress] = React.useState<string | null>(null);
  const [txs, setTxs] = React.useState<any[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const itemsPerPage = 5;

  // Fetch user's stored wallet address from their profile
  React.useEffect(() => {
    async function fetchStoredWallet() {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single();
        
        setStoredWalletAddress(profile?.wallet_address || null);
      }
    }
    fetchStoredWallet();
  }, [user, supabase]);

  // Check if the connected wallet matches the user's stored wallet
  const isUserWalletConnected = isConnected && 
    storedWalletAddress && 
    connectedAddress === storedWalletAddress;

  React.useEffect(() => {
    async function load() {
      if (isUserWalletConnected && connectedAddress) {
        setIsLoading(true);
        const data = await getRecentTransactions(connectedAddress);
        // Filter for incoming payments
        const incoming = data?.filter((tx: any) => tx.sender_address !== connectedAddress) || [];
        setTxs(incoming);
        setIsLoading(false);
      } else {
        // No wallet connected or doesn't match - clear transactions
        setTxs([]);
        setIsLoading(false);
      }
    }
    load();
  }, [isUserWalletConnected, connectedAddress, getRecentTransactions]);

  const allEarnings = txs.map(tx => ({
    from: tx.sender_address.substring(0, 10) + '...',
    ref: tx.tx_type === 'smart_contract' ? (tx.contract_call?.function_name || 'Payment') : 'Transfer',
    amount: `+${(Number(tx.stx_received || tx.token_transfer?.amount || 0) / 1_000_000).toLocaleString()} STX`,
    date: new Date(tx.burn_block_time * 1000).toLocaleDateString()
  }));

  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentEarnings = allEarnings.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(allEarnings.length / itemsPerPage);

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Earnings</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs" disabled={!isUserWalletConnected}>Download CSV</Button>
            <Link href="/dashboard/history">
              <Button variant="ghost" size="sm" className="text-xs text-primary font-bold">View All</Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isUserWalletConnected ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Wallet Connected</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Connect your Stacks wallet to view your earnings and transaction history.
            </p>
          </div>
        ) : currentEarnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <ArrowDownLeft className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Earnings Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You haven't received any payments yet. Your earnings will appear here once you receive them.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground font-medium bg-accent/5">
                    <th className="px-6 py-4 text-left">Sender</th>
                    <th className="px-6 py-4 text-left">Reference</th>
                    <th className="px-6 py-4 text-left">Amount</th>
                    <th className="px-6 py-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {currentEarnings.map((income, i) => (
                    <tr key={i} className="group hover:bg-accent/30 transition-colors">
                      <td className="py-4 px-6 font-semibold group-hover:text-primary transition-colors">{income.from}</td>
                      <td className="py-4 px-6 text-muted-foreground">{income.ref}</td>
                      <td className="py-4 px-6 font-bold text-green-600 font-mono tracking-tighter">{income.amount}</td>
                      <td className="py-4 px-6 text-right text-muted-foreground">{income.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t px-6 pb-4">
              <p className="text-xs text-muted-foreground truncate">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, allEarnings.length)} of {allEarnings.length}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
