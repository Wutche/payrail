# Payrail

---

<p align="center">
  <img src="public/payrail-logo.svg" width="200" alt="Payrail Logo" />
</p>

<h3 align="center">The Decentralized Payroll Engine</h3>

<p align="center">
  <b>A High-Performance, Non-Custodial Infrastructure for Global Workforce Payments on Bitcoin & Stacks.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NETWORK-STACKS_TESTNET-5546FF?style=for-the-badge&logo=stacks&logoColor=white" />
  <img src="https://img.shields.io/badge/ASSETS-BTC_%7C_STX-FF6B00?style=for-the-badge&logo=bitcoin&logoColor=white" />
  <img src="https://img.shields.io/badge/CONTRACT-CLARITY_2.1-71717A?style=for-the-badge&logo=docsdotrs&logoColor=white" />
  <img src="https://img.shields.io/badge/FRONTEND-NEXT.JS_15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/DATA-SUPABASE_POSTGRES-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

---

## 🌟 Vision & Philosophy

Payrail was born from a fundamental frustration: **global payroll is slow, expensive, and opaque.** In a world of decentralized teams, why do we still rely on centralized bank silos?

Payrail reimagines payroll as a **verifiable on-chain protocol**. By anchoring payments to the Bitcoin blockchain via the Stacks Layer 2, we provide businesses with:

- **Absolute Financial Sovereignty**: No bank can freeze your payroll. No custodian holds your keys.
- **Atomic Precision**: Payments that either happen perfectly or not at all.
- **Trustless Transparency**: A public (yet privacy-conscious) ledger of truth for every salary disbursement.

---

## 🏗️ Technical Blueprint

Payrail utilizes a dual-layer architecture to provide a seamless "Web2.5" experience—the speed of a centralized app with the security of a trustless blockchain.

### 🧩 System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE (NEXT.JS 15)                 │
│   ┌────────────────────┐   ┌────────────────────────────────┐   │
│   │ Dashboard & Admin  │ <─┤ Framer Motion & Tailwind v4    │   │
│   └─────────┬──────────┘   └────────────────────────────────┘   │
└─────────────┼───────────────────────────────────────────────────┘
              │
    ┌─────────▼───────────────┐        ┌──────────────────────────┐
    │    EXTERNAL SERVICES    │        │      DATA STORAGE        │
    │  ┌───────────────────┐  │        │  ┌────────────────────┐  │
    │  │  CoinGecko API    │  │        │  │  Supabase (PG)     │  │
    │  └───────────────────┘  │◄───────┤  │  (Metadata/History)│  │
    │  ┌───────────────────┐  │        │  └────────────────────┘  │
    │  │  Resend/Mailjet   │  │
    │  └───────────────────┘  │
    └─────────┬───────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                  BLOCKCHAIN EXECUTION LAYER                     │
│   ┌────────────────────┐   ┌────────────────────────────────┐   │
│   │ Stacks (L2) Node   │ <─┤ payrail.clar (Smart Contract)   │   │
│   └─────────┬──────────┘   └────────────────────────────────┘   │
└─────────────┼───────────────────────────────────────────────────┘
              ▼
    ┌────────────────────────┐
    │ BITCOIN (Finality)     │
    └────────────────────────┘
```

---

## 💡 Innovation: The Batch Payment Protocol

The "Crown Jewel" of Payrail is its **High-Throughput Batching Engine**. Traditional blockchain transfers require a $1:1$ ratio between transactions and recipients. Payrail shatters this limit.

### Deep Technical Insight: `fold` Recursion

Inside `payrail.clar`, we utilize the `fold` operation to process mass payments. This is an **Iterative Map-Reduce** style logic that allows us to process up to 20 recipients in one atomic call.

**The Benefits:**

1.  **Atomic Integrity**: If transaction #19 fails due to an invalid address, _every_ previous payment in that batch is rolled back. No one gets half-paid.
2.  **Fee Compression**: By bundling, we minimize the data footprint on the Stacks blockchain, reducing total gas costs for the employer significantly.
3.  **Performance**: Mass actions that would take 10 minutes manually now happen in a single wallet signature.

---

## 📄 Smart Contract Internals (`payrail.clar`)

Our contract is built for the **Stacks 2.1** environment, ensuring high security and clarity.

### Core Data Maps

- `businesses`: Tracks registered wallet addresses and their associated `org-id`.
- `organizations`: Maps `uint` IDs to organization metadata (owner, name).
- `freelancer-registry`: A simple validator to ensure recipient addresses are active.

### Key Public API

- `register-business`: Entry point for organization owners.
- `create-organization`: Initializes a workspace on-chain.
- `execute-payroll`: Handles a single, standard STX disbursement.
- `execute-batch-payroll`: The core engine for multiple payments.

---

## 🛡️ Security & Non-Custodial Math

At Payrail, we operate under the **"Don't Trust, Verify"** mantra.

### Stacks Post-Conditions

Every transaction in Payrail is guarded by **Post-Conditions**. This is a Stacks-specific security feature that lets the user's wallet say: _"I am signing this contract call, BUT if it tries to spend even ONE uSTX more than my selected batch total, fail the entire transaction."_

This makes Payrail **immune to common smart contract drainage exploits**.

### Zero-Asset Custody

The binary for Payrail never sees, stores, or transmits your private keys. All signing happens within your wallet interface (Leather, Hiro, Xverse).

---

## 🛠️ Developer & Contributor Guide

### The `useStacks` Hook

Our custom hook abstracts the complexity of the Stacks JS SDK.

```typescript
const { executeBatchPayroll, address } = useStacks();

// Triggering a 20-person batch:
await executeBatchPayroll(recipients, "Jan-2026-Payroll");
```

### Server Actions Architecture

Team management (names, roles, rates) is handled via **Next.js Server Actions** (`src/app/actions/team.ts`), which provide a secure, server-side interface to Supabase.

---

## 🚀 Setup & Launch

### 1. Local Development

```bash
# Clone the repository
git clone https://github.com/Wutche/payrail.git
cd payrail

# Install premium dependencies
npm install

# Environment variables
# Copy .env.example to .env.local and fill in your Stacks/Supabase keys

# Run
npm run dev
```

### 2. Testing

We use **Jest** and **Testing Library** for UI verification and **Clarinet** for smart contract testing.

```bash
npm test
```

---

## 🏆 Impact: Why it Matters

Payrail represents a shift from "Financial Services" to "Financial Software."

- **For Businesses**: Tax-ready reporting with immutable blockchain hashes.
- **For Workers**: Instant global liquidity without waiting for SWIFT or SEPA.
- **For the World**: A demonstration of Bitcoin's utility beyond a store of value.

---

## �️ Evolution Roadmap

### **Phase 1: Foundation (Q1 2026 - Current)**

- [x] **Core Protocol**: Deployment of `payrail.clar` for single & batch settlements.
- [x] **Batching Engine**: Support for up to 20 recipients in a single atomic transaction.
- [x] **Management Dashboard**: Secure organization and recipient management via Supabase.
- [x] **Real-time Price Feeds**: Integration with CoinGecko for BTC/STX price parity.

### **Phase 2: Advanced Commerce (Q2 2026)**

- [ ] **Native USDCx Support**: Direct payout integration with Circle's native USDC on Stacks.
- [ ] **sBTC Integration**: Enabling 1:1 Bitcoin-backed payouts as sBTC goes live on Stacks.
- [ ] **Scheduled Payroll**: Implementation of a decentralized cron-layer for automated week-over-week payouts.
- [ ] **Tax-Ready Exports**: Generate cryptographically signed PDF/CSV reports for international tax compliance.

### **Phase 3: The Enterprise Suite (Q3 2026)**

- [ ] **Multi-Sig Auth**: Compatibility with corporate treasury tools like Asigna.
- [ ] **Tiered Org Permissions**: Roles for "Finance Leads" (execute) vs "Auditors" (view-only).
- [ ] **Advanced Analytics**: Visualizing payroll spending, trends, and projected budget burns.
- [ ] **Direct Fiat On-Ramps**: Allowing employers to fund payroll wallets via traditional bank transfers.

---

## �📄 License

This intellectual property is licensed under the **MIT License**.

---
