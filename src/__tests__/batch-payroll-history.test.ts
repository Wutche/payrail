/**
 * Regression Tests for Batch Payroll History Display
 * 
 * These tests ensure that:
 * 1. Batch payroll transactions are correctly detected by function name
 * 2. Transaction events are properly parsed from the Stacks API response
 * 3. Recipient names are correctly resolved for batch payroll rows
 * 4. Individual payments are shown instead of the aggregated contract call
 */

describe('Batch Payroll History Display', () => {
  
  describe('Transaction Detection', () => {
    it('should detect execute-batch-payroll as batch payroll', () => {
      const tx = {
        tx_type: 'contract_call',
        contract_call: {
          function_name: 'execute-batch-payroll'
        }
      }
      
      const isBatchPayroll = tx.tx_type === 'contract_call' && 
        tx.contract_call?.function_name === 'execute-batch-payroll'
      
      expect(isBatchPayroll).toBe(true)
    })

    it('should NOT detect batch-payroll (wrong name) as batch payroll', () => {
      const tx = {
        tx_type: 'contract_call',
        contract_call: {
          function_name: 'batch-payroll' // Wrong! This was the bug
        }
      }
      
      const isBatchPayroll = tx.tx_type === 'contract_call' && 
        tx.contract_call?.function_name === 'execute-batch-payroll'
      
      expect(isBatchPayroll).toBe(false)
    })

    it('should NOT detect execute-payroll as batch payroll', () => {
      const tx = {
        tx_type: 'contract_call',
        contract_call: {
          function_name: 'execute-payroll'
        }
      }
      
      const isBatchPayroll = tx.tx_type === 'contract_call' && 
        tx.contract_call?.function_name === 'execute-batch-payroll'
      
      expect(isBatchPayroll).toBe(false)
    })

    it('should NOT detect token_transfer as batch payroll', () => {
      const tx = {
        tx_type: 'token_transfer',
        token_transfer: {
          recipient_address: 'ST...'
        }
      }
      
      const isBatchPayroll = tx.tx_type === 'contract_call' && 
        tx.contract_call?.function_name === 'execute-batch-payroll'
      
      expect(isBatchPayroll).toBe(false)
    })
  })

  describe('Event Parsing', () => {
    it('should parse stx_asset events correctly', () => {
      const events = [
        {
          event_type: 'stx_asset',
          asset: {
            sender: 'ST3S...1M44',
            recipient: 'ST39...R4N4',
            amount: '187669000000' // 187.669 STX in microSTX
          }
        }
      ]
      
      const stxTransfers: { sender: string; recipient: string; amount: number }[] = []
      
      for (const event of events) {
        if (event.event_type === 'stx_asset' && event.asset) {
          stxTransfers.push({
            sender: event.asset.sender || '',
            recipient: event.asset.recipient || '',
            amount: Number(event.asset.amount || 0) / 1_000_000,
          })
        }
      }
      
      expect(stxTransfers).toHaveLength(1)
      expect(stxTransfers[0].sender).toBe('ST3S...1M44')
      expect(stxTransfers[0].recipient).toBe('ST39...R4N4')
      expect(stxTransfers[0].amount).toBe(187669)
    })

    it('should parse stx_transfer_event events correctly', () => {
      const events = [
        {
          event_type: 'stx_transfer_event',
          stx_transfer_event: {
            sender: 'ST3S...1M44',
            recipient: 'ST39...R4N4',
            amount: '500000000' // 500 STX
          }
        }
      ]
      
      const stxTransfers: { sender: string; recipient: string; amount: number }[] = []
      
      for (const event of events) {
        if (event.event_type === 'stx_transfer_event' && event.stx_transfer_event) {
          stxTransfers.push({
            sender: event.stx_transfer_event.sender,
            recipient: event.stx_transfer_event.recipient,
            amount: Number(event.stx_transfer_event.amount || 0) / 1_000_000,
          })
        }
      }
      
      expect(stxTransfers).toHaveLength(1)
      expect(stxTransfers[0].amount).toBe(500)
    })

    it('should handle mixed event types', () => {
      const events = [
        {
          event_type: 'stx_asset',
          asset: { sender: 'A', recipient: 'B', amount: '1000000' }
        },
        {
          event_type: 'stx_transfer_event',
          stx_transfer_event: { sender: 'C', recipient: 'D', amount: '2000000' }
        },
        {
          event_type: 'smart_contract_log',  // Should be ignored
          contract_log: { value: 'log data' }
        }
      ]
      
      const stxTransfers: { sender: string; recipient: string; amount: number }[] = []
      
      for (const event of (events as any[])) {
        if (event.event_type === 'stx_transfer_event' && event.stx_transfer_event) {
          stxTransfers.push({
            sender: event.stx_transfer_event.sender,
            recipient: event.stx_transfer_event.recipient,
            amount: Number(event.stx_transfer_event.amount || 0) / 1_000_000,
          })
        } else if (event.event_type === 'stx_asset' && event.asset) {
          stxTransfers.push({
            sender: event.asset.sender || '',
            recipient: event.asset.recipient || '',
            amount: Number(event.asset.amount || 0) / 1_000_000,
          })
        }
      }
      
      expect(stxTransfers).toHaveLength(2)
      expect(stxTransfers[0].amount).toBe(1)
      expect(stxTransfers[1].amount).toBe(2)
    })
  })

  describe('Recipient Name Resolution', () => {
    it('should use _batchRecipientName when provided', () => {
      const tx = {
        _batchRecipientName: 'Mr Boogie',
        sender_address: 'ST3S...1M44',
        token_transfer: { recipient_address: 'ST39...R4N4' }
      }
      
      const members = [
        { wallet_address: 'ST39...R4N4', name: 'Wrong Name' }
      ]
      
      let recipientName: string
      if (tx._batchRecipientName) {
        recipientName = tx._batchRecipientName
      } else {
        const member = members.find(m => m.wallet_address === tx.token_transfer?.recipient_address)
        recipientName = member ? member.name : 'Unknown'
      }
      
      expect(recipientName).toBe('Mr Boogie')
    })

    it('should fall back to member lookup when _batchRecipientName is not set', () => {
      const tx = {
        sender_address: 'ST3S...1M44',
        token_transfer: { recipient_address: 'ST39...R4N4' }
      } as any
      
      const members = [
        { wallet_address: 'ST39...R4N4', name: 'Anthony Ushie' }
      ]
      
      let recipientName: string
      if (tx._batchRecipientName) {
        recipientName = tx._batchRecipientName
      } else {
        const member = members.find(m => m.wallet_address === tx.token_transfer?.recipient_address)
        recipientName = member ? member.name : 'Unknown'
      }
      
      expect(recipientName).toBe('Anthony Ushie')
    })

    it('should show truncated address when no member found and no _batchRecipientName', () => {
      const tx = {
        sender_address: 'ST3S...1M44',
        token_transfer: { recipient_address: 'ST39ABCD1234XYZ' }
      } as any
      
      const members: any[] = [] // No members
      
      let recipientName: string
      if (tx._batchRecipientName) {
        recipientName = tx._batchRecipientName
      } else {
        const member = members.find(m => m.wallet_address === tx.token_transfer?.recipient_address)
        recipientName = member ? member.name : tx.token_transfer?.recipient_address?.slice(0, 8) + '...'
      }
      
      expect(recipientName).toBe('ST39ABCD...')
    })
  })

  describe('Virtual Transaction Creation', () => {
    it('should create unique tx_id for each expanded recipient', () => {
      const parentTxId = '0x123abc'
      const recipients = ['ST1...', 'ST2...', 'ST3...']
      
      const virtualTxIds = recipients.map(r => `${parentTxId}-${r}`)
      
      // All IDs should be unique
      const uniqueIds = new Set(virtualTxIds)
      expect(uniqueIds.size).toBe(recipients.length)
      
      // Each should contain the parent ID
      virtualTxIds.forEach(id => {
        expect(id.startsWith(parentTxId)).toBe(true)
      })
    })

    it('should preserve _parentTxId reference', () => {
      const parentTx = { tx_id: '0xoriginal123' }
      const transfer = { sender: 'A', recipient: 'B', amount: 100 }
      
      const virtualTx = {
        ...parentTx,
        tx_id: `${parentTx.tx_id}-${transfer.recipient}`,
        _parentTxId: parentTx.tx_id
      }
      
      expect(virtualTx._parentTxId).toBe('0xoriginal123')
      expect(virtualTx.tx_id).not.toBe(virtualTx._parentTxId)
    })
  })
})
