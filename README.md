# Payrail

---

<p align="center">
  <img src="public/payrail-logo.svg" width="200" alt="Payrail Logo" />
</p>

> _The Decentralized Payroll Engine & The Future of Non-Custodial Workforce Payments_

<p align="center">
  <img src="https://img.shields.io/badge/STACKS-TESTNET-5546FF?style=for-the-badge&logo=stacks&logoColor=white" />
  <img src="https://img.shields.io/badge/BITCOIN-STX-FF6B00?style=for-the-badge&logo=bitcoin&logoColor=white" />
  <img src="https://img.shields.io/badge/NEXT.JS-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/SUPABASE-POSTGRES-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/BATCH-PROTOCOL-FFA500?style=for-the-badge&logo=fastapi&logoColor=white" />
</p>

**Problem:** Custodial Risk & Global Payment Friction. **Solution:** A Non-custodial, Atomic Payroll Protocol on Stacks.

**Payrail** bridges the gap between traditional business management and the Bitcoin economy. It allows organizations to execute high-volume payroll with instant settlement and 100% financial sovereignty. By leveraging the **Batch Payment Protocol**, Payrail turns a manual, error-prone task into a single, secure, and verifiable on-chain event.

---

## 💡 Innovation: The Atomic Batching Engine

Payrail introduces a native blockchain optimization for workforce management. Unlike standard transfers that drain gas and time, Payrail bundles your entire payroll into a single **Atomic Transaction**.

- **Zero Counterparty Risk**: Funds move directly from your wallet to your team.
- **Smart Contract Verified**: Every payment is governed by the `payrail.clar` contract.
- **Micro-Fee Optimization**: Pay up to **20 people** for the price of one network transaction.

---

## 🏗️ Technical Architecture

Payrail uses a high-performance stack to ensure the dashboard remains reactive even handles complex blockchain states.

```mermaid
graph TD
    A[Organization] -->|Batch Execution| B{Payrail Contract}
    B -->|Verified| C[Employee 1]
    B -->|Verified| D[Employee 2]
    B -->|Verified| E[Employee N]

    style B fill:#FF6B00,stroke:#333,stroke-width:2px,color:#fff
```

### Full-Stack Breakdown

- **Frontend**: Next.js 15, Tailwind CSS v4, Framer Motion.
- **Blockchain**: Clarity (Stacks L2), Leather/Hiro Wallet Integration.
- **Infrastructure**: Supabase (Metadata), Resend (Notifications).
- **Security**: Stacks Post-Conditions (Asset Protection).

---

## 🚀 Installation & Setup

### Prerequisites

- [Node.js v20+](https://nodejs.org/)
- [Leather Wallet](https://leather.io/)

### Quick Start

```bash
# Clone and install
git clone https://github.com/Wutche/payrail.git
cd payrail && npm install

# Configure your environment
cp .env.example .env.local

# Launch the engine
npm run dev
```

---

## 🏆 The Payrail Advantage

- **For Owners**: Absolute control. No bank freezes, no middleman fees.
- **For Teams**: Instant liquidity. Get paid in Bitcoin-backed STX.
- **For the Ecosystem**: Scaling financial activity on the Bitcoin layer.

---

## 📄 License

MIT License © 2026 Payrail Foundation.

---

_Built for the next generation of decentralized workforces._
