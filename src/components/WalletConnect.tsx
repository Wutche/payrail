'use client'

import * as React from 'react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStacks } from '@/hooks/useStacks'
import { Button } from '@/components/ui/button'
import { Wallet, CheckCircle2, Loader2, Link2Off, AlertCircle } from 'lucide-react'
import { MobileWalletModal, isMobileDevice } from '@/components/MobileWalletModal'

export const WalletConnect = () => {
  const { user } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const { isConnected, address: stacksAddress, connectWallet, disconnectWallet } = useStacks()
  const [syncing, setSyncing] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)
  const [storedWalletAddress, setStoredWalletAddress] = useState<string | null>(null)
  const [walletBelongsToOther, setWalletBelongsToOther] = useState(false)

  // Fetch user's stored wallet address
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

  // Check if the connected wallet matches user's stored wallet
  const isUserWalletConnected = isConnected && 
    storedWalletAddress && 
    stacksAddress === storedWalletAddress

  // Sync wallet address to Supabase when user connects
  React.useEffect(() => {
    const syncWallet = async () => {
      if (user && stacksAddress && isConnected && !syncing) {
        try {
          // Check if already synced
          if (storedWalletAddress === stacksAddress) {
            return // Already synced
          }

          // Check if this wallet is already used by another user
          const { data: existingWallet } = await supabase
            .from('profiles')
            .select('id')
            .eq('wallet_address', stacksAddress)
            .neq('id', user.id)
            .maybeSingle()

          if (existingWallet) {
            // Wallet is already assigned to another user
            setWalletBelongsToOther(true)
            console.warn('This wallet is already linked to another account')
            return
          }

          setWalletBelongsToOther(false)
          setSyncing(true)
          const { error } = await supabase
            .from('profiles')
            .update({ wallet_address: stacksAddress })
            .eq('id', user.id)
          
          if (error) {
            console.error('Error syncing wallet address:', error.message)
          } else {
            // Update local state to reflect the sync
            setStoredWalletAddress(stacksAddress)
          }
        } catch (err) {
          console.error('Sync error:', err)
        } finally {
          setSyncing(false)
        }
      }
    }
    syncWallet()
  }, [stacksAddress, isConnected, user, supabase, storedWalletAddress])

  const handleConnectClick = () => {
    // Check if on mobile
    if (isMobileDevice()) {
      setShowMobileModal(true)
    } else {
      connectWallet()
    }
  }

  // Show warning if a wallet is connected in browser but belongs to another user
  if (isConnected && walletBelongsToOther) {
    return (
      <>
        <div className="w-full">
          <div className="p-6 border-2 border-dashed border-yellow-500/30 bg-yellow-50/10 rounded-2xl space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-yellow-600">Wallet In Use</p>
                <p className="text-xs text-muted-foreground">This wallet is linked to another account</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={disconnectWallet}
              className="w-full rounded-xl h-10"
            >
              <Link2Off className="mr-2 h-4 w-4" />
              Disconnect & Use Different Wallet
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="w-full">
        {!isUserWalletConnected ? (
          <Button
            onClick={handleConnectClick}
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 group"
          >
            <Wallet className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
            Connect Stacks Wallet
          </Button>
        ) : (
          <div className="p-6 border-2 border-dashed border-primary/20 bg-primary/5 rounded-2xl space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {syncing ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">
                  {syncing ? 'Syncing Address...' : 'Wallet Linked'}
                </p>
                <p className="text-xs font-mono text-muted-foreground truncate">{stacksAddress}</p>
              </div>
            </div>
            
            {!syncing && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={disconnectWallet}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full rounded-xl h-10"
              >
                <Link2Off className="mr-2 h-4 w-4" />
                Disconnect Wallet
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mobile Wallet Selection Modal */}
      <MobileWalletModal
        isOpen={showMobileModal}
        onClose={() => setShowMobileModal(false)}
        onDesktopConnect={connectWallet}
      />
    </>
  )
}

