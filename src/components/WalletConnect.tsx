'use client'

import * as React from 'react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useStacks } from '@/hooks/useStacks'
import { Button } from '@/components/ui/button'
import { Wallet, CheckCircle2, Loader2, Link2Off } from 'lucide-react'
import { MobileWalletModal, isMobileDevice } from '@/components/MobileWalletModal'

export const WalletConnect = () => {
  const { user } = useAuth()
  const supabase = React.useMemo(() => createClient(), [])
  const { isConnected, address: stacksAddress, connectWallet, disconnectWallet } = useStacks()
  const [syncing, setSyncing] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)

  // Use an effect to sync the stacksAddress to Supabase when it changes
  React.useEffect(() => {
    const syncWallet = async () => {
      if (user && stacksAddress && !syncing) {
        try {
          // Check if already synced to avoid loops
          const { data: profile } = await supabase
            .from('profiles')
            .select('wallet_address')
            .eq('id', user.id)
            .single()

          if (profile?.wallet_address === stacksAddress) {
            return
          }

          setSyncing(true)
          const { error } = await supabase
            .from('profiles')
            .update({ wallet_address: stacksAddress })
            .eq('id', user.id)
          
          if (error) {
            console.error('Error syncing wallet address:', error.message)
          }
        } catch (err) {
          console.error('Sync error:', err)
        } finally {
          setSyncing(false)
        }
      }
    }
    syncWallet()
  }, [stacksAddress, user, supabase])

  const handleConnectClick = () => {
    // Check if on mobile
    if (isMobileDevice()) {
      setShowMobileModal(true)
    } else {
      connectWallet()
    }
  }

  return (
    <>
      <div className="w-full">
        {!isConnected ? (
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

