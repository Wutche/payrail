'use client'

import * as React from 'react'
import { useStacks } from '@/hooks/useStacks'
import { MobileWalletModal, isMobileDevice } from '@/components/MobileWalletModal'

/**
 * Hook that provides mobile-aware wallet connection
 * On mobile: opens a modal with wallet app options and deep links
 * On desktop: uses standard Stacks Connect popup
 */
export function useMobileWallet() {
  const stacks = useStacks()
  const [showMobileModal, setShowMobileModal] = React.useState(false)

  const connect = React.useCallback(() => {
    if (isMobileDevice()) {
      setShowMobileModal(true)
    } else {
      stacks.connectWallet()
    }
  }, [stacks])

  const closeMobileModal = React.useCallback(() => {
    setShowMobileModal(false)
  }, [])

  const handleDesktopConnect = React.useCallback(() => {
    setShowMobileModal(false)
    stacks.connectWallet()
  }, [stacks])

  // Component to render the modal - must be placed in JSX
  const MobileModal = React.useCallback(() => (
    <MobileWalletModal
      isOpen={showMobileModal}
      onClose={closeMobileModal}
      onDesktopConnect={handleDesktopConnect}
    />
  ), [showMobileModal, closeMobileModal, handleDesktopConnect])

  return {
    ...stacks,
    connect, // Mobile-aware connect function
    MobileModal, // Component to render in JSX
    showMobileModal,
    closeMobileModal,
  }
}
