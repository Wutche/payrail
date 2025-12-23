'use client'

import { showConnect } from '@stacks/connect'
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network'
import { useState } from 'react'

export const WalletConnect = () => {
  const [address, setAddress] = useState<string | null>(null)
  const isTestnet = process.env.NEXT_PUBLIC_STACKS_NETWORK === 'testnet'
  const network = isTestnet ? STACKS_TESTNET : STACKS_MAINNET

  const connectWallet = () => {
    showConnect({
      appDetails: {
        name: 'Payrail',
        icon: '/favicon.ico', // Update this to your real logo icon
      },
      onFinish: (payload) => {
        const userData = payload.userSession.loadUserData()
        const stxAddress = isTestnet 
          ? userData.profile.stxAddress.testnet 
          : userData.profile.stxAddress.mainnet
        setAddress(stxAddress)
        console.log('Connected Address:', stxAddress)
        // In Task 2.2 we will sync this with Supabase
      },
      onCancel: () => {
        console.log('Wallet connection cancelled')
      },
    })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {!address ? (
        <button
          onClick={connectWallet}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition-colors shadow-lg"
        >
          Connect Stacks Wallet
        </button>
      ) : (
        <div className="p-4 border border-green-200 bg-green-50 rounded-lg text-center">
          <p className="text-sm text-green-800 font-medium">Wallet Connected</p>
          <p className="text-xs font-mono break-all mt-1">{address}</p>
          <button 
            onClick={() => setAddress(null)}
            className="mt-2 text-xs text-red-600 hover:underline"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
