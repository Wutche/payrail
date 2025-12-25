'use client'

import { useCallback } from 'react'
import * as StacksConnect from '@stacks/connect'
import { STACKS_TESTNET } from '@stacks/network'
import {
  AnchorMode,
  PostConditionMode,
  uintCV,
  stringAsciiCV,
  principalCV,
  fetchCallReadOnlyFunction,
  ClarityType,
} from '@stacks/transactions'
import { userSession } from '@/components/StacksProvider'
import { useNotification } from '@/components/NotificationProvider'

// Every data point is dynamic - contract configuration comes from environment variables
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || 'payrail'

export function useStacks() {
  const network = STACKS_TESTNET
  const { showNotification } = useNotification()

  const isBrowser = typeof window !== 'undefined'
  const userData = (isBrowser && userSession && userSession.isUserSignedIn()) ? userSession.loadUserData() : null
  
  // Wallet address is dynamic - derived from the connected session
  const address = userData?.profile?.stxAddress?.testnet ?? 
                 userData?.profile?.stxAddress?.mainnet ?? 
                 null
  const isConnected = !!address

  const connectWallet = useCallback(() => {
    // Robust wallet connection flow
    const authOptions = {
      userSession: userSession as any,
      appDetails: {
        name: 'Payrail',
        icon: typeof window !== 'undefined' ? window.location.origin + '/favicon.ico' : '/favicon.ico',
      },
      onFinish: () => {
        window.location.reload()
      },
      onCancel: () => {
        console.log('User cancelled login')
      },
      theme: 'dark' as const,
    };

    // Try multiple export names to handle different package versions/bundlers
    const connectFn = StacksConnect.showConnect || 
                     (StacksConnect as any).authenticate || 
                     (StacksConnect as any).showBlockstackConnect;

    if (typeof connectFn === 'function') {
      connectFn(authOptions);
    } else {
      console.error('Could not find Stacks connection function in @stacks/connect');
      alert('Wallet connection error. Please ensure you have a Stacks wallet installed.');
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    userSession.signUserOut()
    window.location.reload()
  }, [])

  // --- Public Transactions ---

  const registerBusiness = useCallback(async () => {
    return StacksConnect.openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'register-business',
      functionArgs: [],
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      onFinish: (data: any) => {
        console.log('Register business finished:', data)
        showNotification('success', 'Business registration broadcasted!')
      },
      onCancel: () => {
        console.log('Register business cancelled')
        showNotification('info', 'Registration cancelled')
      },
    })
  }, [network, showNotification])

  const createOrganization = useCallback(async (name: string) => {
    return StacksConnect.openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'create-organization',
      functionArgs: [stringAsciiCV(name)],
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      onFinish: (data: any) => {
        console.log('Create organization finished:', data)
        showNotification('success', 'Organization creation broadcasted!')
      },
      onCancel: () => {
        console.log('Create organization cancelled')
        showNotification('info', 'Organization creation cancelled')
      },
    })
  }, [network, showNotification])

  const executePayroll = useCallback(async (recipient: string, amount: number, onFinish?: () => void) => {
    // amount is in STX, need uSTX (10^6)
    const amountUSTX = Math.floor(amount * 1_000_000)
    
    return StacksConnect.openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'execute-payroll',
      functionArgs: [principalCV(recipient), uintCV(amountUSTX)],
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
      onFinish: (data: any) => {
        console.log('Execute payroll finished:', data)
        showNotification('success', 'Payroll payment broadcasted!')
        if (onFinish) onFinish()
      },
      onCancel: () => {
        console.log('Execute payroll cancelled')
        showNotification('info', 'Payment cancelled')
      },
    })
  }, [network, showNotification])

  const transferSTX = useCallback(async (recipient: string, amount: number, onFinish?: () => void) => {
    // amount is in STX, need uSTX (10^6)
    const amountUSTX = Math.floor(amount * 1_000_000)

    return StacksConnect.openSTXTransfer({
      recipient,
      amount: BigInt(amountUSTX),
      network,
      anchorMode: AnchorMode.Any,
      onFinish: (data: any) => {
        console.log('Transfer STX finished:', data)
        showNotification('success', 'STX transfer broadcasted!')
        if (onFinish) onFinish()
      },
      onCancel: () => {
        console.log('Transfer STX cancelled')
        showNotification('info', 'Transfer cancelled')
      },
    })
  }, [network, showNotification])

  const transferBTC = useCallback(async (recipient: string, amount: number, onFinish?: () => void) => {
    // amount is in BTC, need Satoshis (10^8)
    const amountSats = Math.floor(amount * 100_000_000)

    // Stacks Connect supports Bitcoin transfers in compatible wallets (Xverse, Leather)
    return (StacksConnect as any).openBitcoinTransfer({
      address: recipient,
      amount: amountSats,
      onFinish: (data: any) => {
        console.log('Transfer BTC finished:', data)
        showNotification('success', 'Bitcoin transfer broadcasted!')
        if (onFinish) onFinish()
      },
      onCancel: () => {
        console.log('Transfer BTC cancelled')
        showNotification('info', 'BTC Transfer cancelled')
      },
    })
  }, [showNotification])

  // --- Read-Only Functions ---

  const getBusinessInfo = useCallback(async (businessAddress: string) => {
    try {
      const response = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-business-info',
        functionArgs: [principalCV(businessAddress)],
        network,
        senderAddress: businessAddress,
      })
      
      // Response is (optional { registered: bool, org-id: (optional uint) })
      if (response && response.type === ClarityType.OptionalSome) {
        const val = response.value as any
        // In Stacks.js, TupleCV data is usually in .data or .value
        const tupleData = val.data || val.value || val
        
        const orgIdCV = tupleData && typeof tupleData === 'object' ? tupleData['org-id'] : null
        const hasOrg = orgIdCV && orgIdCV.type === ClarityType.OptionalSome
        
        return { isRegistered: true, hasOrg, raw: response }
      }
      return { isRegistered: false, hasOrg: false, raw: response }
    } catch (e) {
      console.error('Error fetching business info:', e)
      return { isRegistered: false, error: e }
    }
  }, [network])

  const getSTXBalance = useCallback(async (stxAddress: string) => {
    try {
      const isMainnet = CONTRACT_ADDRESS.startsWith('S') && !CONTRACT_ADDRESS.startsWith('ST')
      const apiUrl = isMainnet
        ? 'https://api.mainnet.hiro.so' 
        : 'https://api.testnet.hiro.so'
      const response = await fetch(`${apiUrl}/extended/v1/address/${stxAddress}/balances`)
      const data = await response.json()
      // Amount is in uSTX, convert to STX
      const balance = parseInt(data.stx.balance) / 1_000_000
      return balance
    } catch (e) {
      console.error('Error fetching STX balance:', e)
      return 0
    }
  }, [network])

  const getRecentTransactions = useCallback(async (stxAddress: string) => {
    try {
      const isMainnet = CONTRACT_ADDRESS.startsWith('S') && !CONTRACT_ADDRESS.startsWith('ST')
      const apiUrl = isMainnet
        ? 'https://api.mainnet.hiro.so' 
        : 'https://api.testnet.hiro.so'
      const response = await fetch(`${apiUrl}/extended/v1/address/${stxAddress}/transactions?limit=20`)
      const data = await response.json()
      return data.results
    } catch (e) {
      console.error('Error fetching transactions:', e)
      return []
    }
  }, [network])

  const getSTXPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd')
      const data = await response.json()
      return data.blockstack.usd as number
    } catch (e) {
      console.error('Error fetching STX price:', e)
      return 0
    }
  }, [])

  const getBTCPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
      const data = await response.json()
      return data.bitcoin.usd as number
    } catch (e) {
      console.error('Error fetching BTC price:', e)
      return 0
    }
  }, [])

  return {
    address,
    isConnected,
    connectWallet,
    disconnectWallet,
    registerBusiness,
    createOrganization,
    executePayroll,
    transferSTX,
    transferBTC,
    getBusinessInfo,
    getSTXBalance,
    getRecentTransactions,
    getSTXPrice,
    getBTCPrice,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    network,
    isTestnet: network.chainId === 2147483648, // ChainID.Testnet
  }
}
