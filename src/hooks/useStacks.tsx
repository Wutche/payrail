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
  listCV,
  tupleCV,
  fetchCallReadOnlyFunction,
  ClarityType,
  Pc,
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
        // User cancelled login - this is expected, do nothing
        console.log('User cancelled login')
      },
      theme: 'dark' as const,
    };

    try {
      // Try multiple export names to handle different package versions/bundlers
      const connectFn = StacksConnect.showConnect || 
                       (StacksConnect as any).authenticate || 
                       (StacksConnect as any).showBlockstackConnect;

      if (typeof connectFn === 'function') {
        connectFn(authOptions);
      } else {
        console.error('Could not find Stacks connection function in @stacks/connect');
        showNotification('error', 'Wallet connection error. Please ensure you have a Stacks wallet installed.');
      }
    } catch (error: any) {
      // Handle user cancellation gracefully - this is NOT an error
      if (error?.message?.includes('User canceled') || 
          error?.message?.includes('User rejected') ||
          error?.code === 4001) {
        console.log('User cancelled wallet connection');
        return;
      }
      // Log other errors but don't show to user
      console.error('Wallet connection error:', error);
    }
  }, [showNotification])

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

  const createOrganization = useCallback(async (name: string, onFinish?: (data: any) => void) => {
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
        if (onFinish) onFinish(data)
      },
      onCancel: () => {
        console.log('Create organization cancelled')
        showNotification('info', 'Organization creation cancelled')
      },
    })
  }, [network, showNotification])

  const executePayroll = useCallback(async (recipient: string, amount: number, onFinish?: (data: any) => void) => {
    // amount is in STX, need uSTX (10^6)
    const amountUSTX = Math.floor(amount * 1_000_000)
    
    // Get sender address
    const senderAddress = userData?.profile?.stxAddress?.testnet || userData?.profile?.stxAddress?.mainnet || ''
    
    // Create post-condition: sender will send exactly amountUSTX STX
    // Using Pc builder pattern for @stacks/transactions v7+
    const postConditions = senderAddress ? [
      Pc.principal(senderAddress).willSendEq(amountUSTX).ustx()
    ] : []
    
    return StacksConnect.openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'execute-payroll',
      functionArgs: [principalCV(recipient), uintCV(amountUSTX)],
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: postConditions.length > 0 ? PostConditionMode.Deny : PostConditionMode.Allow,
      postConditions,
      onFinish: (data: any) => {
        console.log('Execute payroll finished:', data)
        showNotification('success', 'Payroll payment broadcasted!')
        if (onFinish) onFinish(data)
      },
      onCancel: () => {
        console.log('Execute payroll cancelled')
        showNotification('info', 'Payment cancelled')
      },
    })
  }, [network, showNotification, userData])

  // Execute batch payroll for multiple recipients in a single transaction
  const executeBatchPayroll = useCallback(async (
    recipients: { address: string; amountSTX: number }[],
    periodRef: string,
    onFinish?: (data: any) => void
  ) => {
    // Build list of tuples: {to: principal, ustx: uint}
    const recipientList = recipients.map(r => 
      tupleCV({
        to: principalCV(r.address),
        ustx: uintCV(Math.floor(r.amountSTX * 1_000_000))
      })
    )
    
    // Calculate total amount for post-condition
    const totalUSTX = recipients.reduce((sum, r) => sum + Math.floor(r.amountSTX * 1_000_000), 0)
    const senderAddress = userData?.profile?.stxAddress?.testnet || userData?.profile?.stxAddress?.mainnet || ''
    
    // Create post-condition for total STX being sent
    const postConditions = senderAddress ? [
      Pc.principal(senderAddress).willSendEq(totalUSTX).ustx()
    ] : []
    
    return StacksConnect.openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'execute-batch-payroll',
      functionArgs: [
        listCV(recipientList),
        stringAsciiCV(periodRef.slice(0, 32)) // Max 32 chars
      ],
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: postConditions.length > 0 ? PostConditionMode.Deny : PostConditionMode.Allow,
      postConditions,
      onFinish: (data: any) => {
        console.log('Batch payroll finished:', data)
        showNotification('success', `Batch payroll broadcasted! ${recipients.length} recipients`)
        if (onFinish) onFinish(data)
      },
      onCancel: () => {
        console.log('Batch payroll cancelled')
        showNotification('info', 'Batch payroll cancelled')
      },
    })
  }, [network, showNotification, userData])

  const transferSTX = useCallback(async (recipient: string, amount: number, onFinish?: (data: any) => void) => {
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
        if (onFinish) onFinish(data)
      },
      onCancel: () => {
        console.log('Transfer STX cancelled')
        showNotification('info', 'Transfer cancelled')
      },
    })
  }, [network, showNotification])

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
      
      // Fetch both confirmed and mempool transactions
      const [confirmedRes, mempoolRes] = await Promise.all([
        fetch(`${apiUrl}/extended/v1/address/${stxAddress}/transactions?limit=50`),
        fetch(`${apiUrl}/extended/v1/address/${stxAddress}/mempool?limit=20`)
      ])
      
      const confirmedData = await confirmedRes.json()
      const mempoolData = await mempoolRes.json()

      // Merge mempool txs (which have limited data) with standard tx format where possible
      // Mempool txs don't have burn_block_time, so we use cur time for sort
      const mempoolTxs = (mempoolData.results || []).map((tx: any) => ({
        ...tx,
        tx_status: 'pending',
        burn_block_time: Math.floor(Date.now() / 1000)
      }))

      return [...mempoolTxs, ...(confirmedData.results || [])]
    } catch (e) {
      console.error('Error fetching transactions:', e)
      return []
    }
  }, [network])

  const getSTXPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd')
      if (!response.ok) throw new Error('Failed to fetch price')
      const data = await response.json()
      return data.blockstack?.usd as number || 0
    } catch (e) {
      console.warn('Error fetching STX price:', e) // Warn instead of error to reduce noise
      return 0 // Return 0 gracefully to prevent app crash
    }
  }, [])

  const getBTCPrice = useCallback(async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
      if (!response.ok) return 0
      const data = await response.json()
      return data.bitcoin?.usd as number || 0
    } catch (e) {
      console.warn('Error fetching BTC price:', e)
      return 0
    }
  }, [])

  // Fetch events/internal transfers for a specific transaction
  const getTransactionEvents = useCallback(async (txId: string) => {
    try {
      const isMainnet = CONTRACT_ADDRESS.startsWith('S') && !CONTRACT_ADDRESS.startsWith('ST')
      const apiUrl = isMainnet
        ? 'https://api.mainnet.hiro.so' 
        : 'https://api.testnet.hiro.so'
      
      const response = await fetch(`${apiUrl}/extended/v1/tx/${txId}`)
      if (!response.ok) return null
      
      const tx = await response.json()
      
      // Extract STX transfer events from contract call
      // These are the actual payments to recipients in batch payroll
      const stxEvents = (tx.events || []).filter((e: any) => e.event_type === 'stx_transfer_event')
      
      return {
        tx,
        stxTransfers: stxEvents.map((e: any) => ({
          sender: e.stx_transfer_event?.sender,
          recipient: e.stx_transfer_event?.recipient,
          amount: Number(e.stx_transfer_event?.amount || 0) / 1_000_000, // Convert uSTX to STX
        }))
      }
    } catch (e) {
      console.error('Error fetching transaction events:', e)
      return null
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
    executeBatchPayroll,
    transferSTX,
    getBusinessInfo,
    getSTXBalance,
    getRecentTransactions,
    getTransactionEvents,
    getSTXPrice,
    getBTCPrice,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    network,
    isTestnet: network.chainId === 2147483648, // ChainID.Testnet
  }
}
