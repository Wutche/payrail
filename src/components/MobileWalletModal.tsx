'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Smartphone, ExternalLink, Download, Wallet, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Mobile wallet configurations
const MOBILE_WALLETS = [
  {
    id: 'xverse',
    name: 'Xverse',
    description: 'Popular Stacks & Bitcoin wallet',
    icon: '/wallets/xverse.svg',
    color: 'from-orange-500 to-red-500',
    // Xverse supports universal links that open their in-app browser
    deepLink: (returnUrl: string) => `https://connect.xverse.app/browser?url=${encodeURIComponent(returnUrl)}`,
    playStore: 'https://play.google.com/store/apps/details?id=com.xverse.wallet',
    appStore: 'https://apps.apple.com/app/xverse-bitcoin-web3-wallet/id1552272513',
    supportsDeepLink: true,
  },
  {
    id: 'leather',
    name: 'Leather',
    description: 'Open in-app browser manually',
    icon: '/wallets/leather.svg',
    color: 'from-purple-500 to-indigo-500',
    // Leather doesn't support proper deep linking from web - provide manual instructions
    deepLink: null,
    playStore: 'https://play.google.com/store/apps/details?id=io.leather.wallet',
    appStore: 'https://apps.apple.com/app/leather-bitcoin-wallet/id6451326108',
    supportsDeepLink: false,
  },
]

// Detect if we're inside a wallet's in-app browser
// In these cases, we should use standard Stacks Connect, not the mobile modal
function isInWalletBrowser(): boolean {
  if (typeof window === 'undefined') return false
  
  // Check for wallet provider injection (Leather and other wallets inject these)
  const hasStacksProvider = !!(window as any).StacksProvider || !!(window as any).LeatherProvider
  const hasHiroWallet = !!(window as any).HiroWalletProvider
  
  // Check user agent for known wallet in-app browsers
  const ua = navigator.userAgent.toLowerCase()
  const isLeatherBrowser = ua.includes('leather')
  const isXverseBrowser = ua.includes('xverse')
  
  return hasStacksProvider || hasHiroWallet || isLeatherBrowser || isXverseBrowser
}

// Detect mobile device (but NOT if we're in a wallet's in-app browser)
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  // If we're inside a wallet's browser, treat it as desktop (use standard connect)
  if (isInWalletBrowser()) return false
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// Detect iOS vs Android
function getMobileOS(): 'ios' | 'android' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown'
  const userAgent = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios'
  if (/android/i.test(userAgent)) return 'android'
  return 'unknown'
}

interface MobileWalletModalProps {
  isOpen: boolean
  onClose: () => void
  onDesktopConnect: () => void
}

export function MobileWalletModal({ isOpen, onClose, onDesktopConnect }: MobileWalletModalProps) {
  const [mounted, setMounted] = React.useState(false)
  const [copiedUrl, setCopiedUrl] = React.useState(false)
  const [showLeatherInstructions, setShowLeatherInstructions] = React.useState(false)
  const isMobile = isMobileDevice()
  const mobileOS = getMobileOS()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleCopyUrl = async () => {
    const currentUrl = window.location.href
    await navigator.clipboard.writeText(currentUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleWalletClick = (wallet: typeof MOBILE_WALLETS[0]) => {
    // For wallets without deep link support, show instructions
    if (!wallet.supportsDeepLink) {
      setShowLeatherInstructions(true)
      return
    }

    const currentUrl = window.location.href
    const deepLinkUrl = wallet.deepLink!(currentUrl)
    
    // Try to open the app via deep link
    const startTime = Date.now()
    
    // For universal links (https://), just navigate directly
    window.location.href = deepLinkUrl
    
    // If app doesn't open within 2 seconds, redirect to app store
    setTimeout(() => {
      if (document.hidden || Date.now() - startTime > 2500) {
        // App likely opened
        return
      }
      
      // App not installed - redirect to store
      const storeUrl = mobileOS === 'ios' ? wallet.appStore : wallet.playStore
      window.open(storeUrl, '_blank')
    }, 2000)
  }

  const handleDesktopConnect = () => {
    onClose()
    onDesktopConnect()
  }

  if (!mounted) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-card border rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 pb-4 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Connect Wallet</h2>
                  <p className="text-xs text-muted-foreground">
                    {isMobile ? 'Choose your wallet app' : 'Connect with browser extension'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {isMobile ? (
                <>
                  {showLeatherInstructions ? (
                    <>
                      {/* Leather Manual Instructions */}
                      <div className="text-center space-y-4">
                        <div className="h-12 w-12 mx-auto rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                          L
                        </div>
                        <h3 className="font-bold">Connect via Leather</h3>
                        <p className="text-sm text-muted-foreground">
                          Leather wallet doesn't support direct linking yet. Follow these steps:
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-xl">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
                          <p className="text-sm">Open the Leather app on your phone</p>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-xl">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
                          <p className="text-sm">Go to the <strong>Browser</strong> tab at the bottom</p>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-accent/30 rounded-xl">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
                          <p className="text-sm">Paste this URL in the browser:</p>
                        </div>
                      </div>

                      <button
                        onClick={handleCopyUrl}
                        className="w-full flex items-center justify-between p-4 bg-accent border border-border rounded-xl hover:bg-accent/80 transition-colors"
                      >
                        <code className="text-xs truncate flex-1 text-left font-mono">
                          {typeof window !== 'undefined' ? window.location.href : ''}
                        </code>
                        {copiedUrl ? (
                          <Check className="h-5 w-5 text-green-500 shrink-0 ml-2" />
                        ) : (
                          <Copy className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
                        )}
                      </button>

                      {copiedUrl && (
                        <p className="text-center text-sm text-green-500 font-medium">URL copied! Now paste it in Leather's browser.</p>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => setShowLeatherInstructions(false)}
                        className="w-full rounded-xl"
                      >
                        ← Back to wallet options
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Mobile Wallet Options */}
                      {MOBILE_WALLETS.map((wallet) => (
                        <button
                          key={wallet.id}
                          onClick={() => handleWalletClick(wallet)}
                          className="w-full flex items-center gap-4 p-4 border rounded-2xl hover:bg-accent/50 transition-all group"
                        >
                          <div className={cn(
                            "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg",
                            wallet.color
                          )}>
                            {wallet.name[0]}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-bold">{wallet.name}</p>
                            <p className="text-xs text-muted-foreground">{wallet.description}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                      ))}

                      {/* Hint */}
                      <div className="flex items-center gap-2 p-3 bg-accent/30 rounded-xl">
                        <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Don't have a wallet? Tap Xverse to download from the app store.
                        </p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* Desktop - Use standard connect */}
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">Browser Extension</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect using your installed wallet extension
                      </p>
                    </div>
                    <Button 
                      onClick={handleDesktopConnect}
                      className="w-full h-12 rounded-xl font-bold"
                    >
                      Connect Wallet
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile indicator bar */}
            <div className="sm:hidden flex justify-center pb-4">
              <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// Export helper for checking mobile
export { isMobileDevice, getMobileOS }

