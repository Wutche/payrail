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
  const { address: connectedAddress, isConnected, getSTXBalance, getRecentTransactions, getSTXPrice } = useStacks();
  
  const [balance, setBalance] = React.useState(0);
  const [lastPayment, setLastPayment] = React.useState(0);
  const [stxPrice, setStxPrice] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  // For freelancers, use the connected wallet directly - they can use any wallet
  const effectiveAddress = isConnected ? connectedAddress : null;
  const hasWallet = !!effectiveAddress;

  React.useEffect(() => {
    async function load() {
      // Always fetch price
      const price = await getSTXPrice();
      setStxPrice(price);
      
      if (hasWallet && effectiveAddress) {
        setIsLoading(true);
        const [stxBal, txs] = await Promise.all([
          getSTXBalance(effectiveAddress),
          getRecentTransactions(effectiveAddress)
        ]);
        setBalance(stxBal);
        
        // Find last received payment
        const lastReceived = txs?.find((tx: any) => tx.sender_address !== effectiveAddress);
        if (lastReceived) {
          const amount = Number(lastReceived.stx_received || lastReceived.token_transfer?.amount || 0) / 1_000_000;
          setLastPayment(amount);
        }
        setIsLoading(false);
      } else {
        // No wallet connected - reset to defaults
        setBalance(0);
        setLastPayment(0);
        setIsLoading(false);
      }
    }
    load();
  }, [hasWallet, effectiveAddress, getSTXBalance, getRecentTransactions, getSTXPrice]);

  // Calculate USD values
  const balanceUsd = balance * stxPrice;
  const lastPaymentUsd = lastPayment * stxPrice;

  const stats = [
    { 
      title: "Current Balance", 
      value: hasWallet ? `${balance.toLocaleString(undefined, { maximumFractionDigits: 3 })} STX` : "0 STX",
      subValue: hasWallet && stxPrice > 0 ? `≈ $${balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
      icon: Wallet, 
      color: hasWallet ? "text-green-600 bg-green-100" : "text-muted-foreground bg-muted" 
    },
    { 
      title: "Last Payment", 
      value: hasWallet ? `${lastPayment.toLocaleString()} STX` : "0 STX",
      subValue: hasWallet && stxPrice > 0 && lastPayment > 0 ? `≈ $${lastPaymentUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
      icon: ArrowDownLeft, 
      color: hasWallet ? "text-blue-600 bg-blue-100" : "text-muted-foreground bg-muted" 
    },
    { 
      title: "Status", 
      value: hasWallet ? "Active" : "Not Connected",
      subValue: null,
      icon: Clock, 
      color: hasWallet ? "text-orange-600 bg-orange-100" : "text-muted-foreground bg-muted" 
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
                {stat.subValue && (
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.subValue}</p>
                )}
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
  const { address: connectedAddress, isConnected, getRecentTransactions } = useStacks();
  const supabase = React.useMemo(() => createClient(), []);
  
  const [txs, setTxs] = React.useState<any[]>([]);
  const [senderNames, setSenderNames] = React.useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const itemsPerPage = 5;

  // For freelancers, use connected wallet directly - they can use any wallet
  const effectiveAddress = isConnected ? connectedAddress : null;
  const hasWallet = !!effectiveAddress;

  // Fetch organization names for sender addresses
  const fetchSenderNames = React.useCallback(async (addresses: string[]) => {
    if (addresses.length === 0) return;
    
    const uniqueAddresses = [...new Set(addresses)];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('wallet_address, organization_name, full_name')
      .in('wallet_address', uniqueAddresses);
    
    if (profiles) {
      const names: Record<string, string> = {};
      profiles.forEach((p: any) => {
        names[p.wallet_address] = p.organization_name || p.full_name || p.wallet_address.substring(0, 10) + '...';
      });
      setSenderNames(names);
    }
  }, [supabase]);

  React.useEffect(() => {
    async function load() {
      if (hasWallet && effectiveAddress) {
        setIsLoading(true);
        const data = await getRecentTransactions(effectiveAddress);
        // Filter for incoming payments
        const incoming = data?.filter((tx: any) => tx.sender_address !== effectiveAddress) || [];
        setTxs(incoming);
        
        // Fetch sender names for all unique sender addresses
        const senderAddresses = incoming.map((tx: any) => tx.sender_address);
        await fetchSenderNames(senderAddresses);
        
        setIsLoading(false);
      } else {
        // No wallet connected - clear transactions
        setTxs([]);
        setSenderNames({});
        setIsLoading(false);
      }
    }
    load();
  }, [hasWallet, effectiveAddress, getRecentTransactions, fetchSenderNames]);

  const allEarnings = txs.map(tx => ({
    from: senderNames[tx.sender_address] || tx.sender_address.substring(0, 10) + '...',
    ref: tx.tx_type === 'smart_contract' ? (tx.contract_call?.function_name || 'Payment') : 'Transfer',
    amount: `+${(Number(tx.stx_received || tx.token_transfer?.amount || 0) / 1_000_000).toLocaleString()} STX`,
    date: new Date(tx.burn_block_time * 1000).toLocaleDateString()
  }));

  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentEarnings = allEarnings.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(allEarnings.length / itemsPerPage);

  // Download CSV function
  const downloadCSV = () => {
    if (allEarnings.length === 0) return;
    
    const headers = ['Sender', 'Reference', 'Amount', 'Date'];
    const csvRows = [
      headers.join(','),
      ...allEarnings.map(e => [
        `"${e.from}"`,
        `"${e.ref}"`,
        `"${e.amount}"`,
        `"${e.date}"`
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payrail-earnings-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Earnings</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs" 
              disabled={!hasWallet || allEarnings.length === 0}
              onClick={downloadCSV}
            >
              Download CSV
            </Button>
            <Link href="/dashboard/history">
              <Button variant="ghost" size="sm" className="text-xs text-primary font-bold">View All</Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasWallet ? (
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
