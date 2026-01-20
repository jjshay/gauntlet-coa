# Deployment Guide

This guide covers deploying all components of the Gauntlet Gallery COA system.

## Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask wallet with POL/MATIC tokens
- Google Cloud service account
- GitHub account
- Vercel account (free tier works)
- Railway account (free tier works)

---

## 1. Smart Contract Deployment

### Option A: Hardhat CLI (Recommended)

**Step 1: Configure environment**

Create `.env` in project root:
```env
PRIVATE_KEY=your_wallet_private_key_without_0x_prefix
```

**Step 2: Install dependencies**
```bash
npm install
```

**Step 3: Deploy to Polygon Mainnet**
```bash
npx hardhat run scripts/deploy.js --network polygon
```

**Step 4: Save the contract address**

The script will output:
```
GauntletCOA deployed to: 0x...
```

Save this address for backend configuration.

### Option B: Remix IDE

1. Go to [Remix IDE](https://remix.ethereum.org)
2. Create new file: `GauntletCOA.sol`
3. Copy contract code from `contracts/GauntletCOA.sol`
4. Compile:
   - Compiler version: 0.8.20
   - EVM version: Paris
   - Optimization: 200 runs
5. Deploy:
   - Environment: Injected Provider (MetaMask)
   - Ensure MetaMask is on Polygon Mainnet
   - Click Deploy

### Polygon Network Configuration

**Mainnet (Production)**
| Setting | Value |
|---------|-------|
| Network Name | Polygon Mainnet |
| RPC URL | https://polygon.llamarpc.com |
| Chain ID | 137 |
| Symbol | POL |
| Explorer | https://polygonscan.com |

**Amoy Testnet (Testing)**
| Setting | Value |
|---------|-------|
| Network Name | Polygon Amoy |
| RPC URL | https://rpc-amoy.polygon.technology |
| Chain ID | 80002 |
| Symbol | MATIC |
| Explorer | https://amoy.polygonscan.com |

---

## 2. Backend Deployment (Railway)

### Step 1: Prepare GitHub Repository

```bash
cd backend
git init
git add .
git commit -m "Initial backend commit"
git remote add origin https://github.com/YOUR_USERNAME/gauntlet-coa-backend.git
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your backend repository
5. Railway auto-detects Node.js

### Step 3: Configure Environment Variables

In Railway dashboard → Variables tab, add:

| Variable | Value | Description |
|----------|-------|-------------|
| `SPREADSHEET_ID` | `16Kya2WQD0tbXTdsug9zSuoP03XmWXsZRTIykbEbBJBU` | Your Google Sheet ID |
| `SHEET_NAME` | `COA` | Sheet tab name |
| `GOOGLE_CREDENTIALS` | `{"type":"service_account",...}` | Full JSON as single line |
| `POLYGON_RPC` | `https://polygon.llamarpc.com` | Polygon RPC URL |
| `CONTRACT_ADDRESS` | `0xD554...b1b1` | Your deployed contract |
| `PORT` | `3001` | Server port |

**Important:** For `GOOGLE_CREDENTIALS`, paste the entire JSON file content as a single line.

### Step 4: Configure Domain

1. Go to Settings → Networking
2. Click "Generate Domain" for a `*.up.railway.app` URL
3. Or add custom domain

### Step 5: Verify Deployment

```bash
curl https://your-app.up.railway.app/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-01-19T12:00:00.000Z"}
```

---

## 3. Frontend Deployment (Vercel)

### Step 1: Prepare GitHub Repository

```bash
cd frontend
git init
git add .
git commit -m "Initial frontend commit"
git remote add origin https://github.com/YOUR_USERNAME/gauntlet-coa-frontend.git
git push -u origin main
```

### Step 2: Create Vercel Project

1. Go to [Vercel](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Framework Preset: Vite
5. Build settings are auto-detected

### Step 3: Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-app.up.railway.app` |

### Step 4: Deploy

Click "Deploy" - Vercel handles the rest.

### Step 5: Verify Deployment

Visit your Vercel URL:
```
https://your-app.vercel.app
```

---

## 4. Google Cloud Setup

### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google Sheets API:
   - APIs & Services → Library
   - Search "Google Sheets API"
   - Click Enable
4. Create service account:
   - APIs & Services → Credentials
   - Create Credentials → Service Account
   - Name: "sheets-integration"
   - Role: None (we only need Sheet access)
5. Create key:
   - Click on service account
   - Keys tab → Add Key → Create new key
   - JSON format
   - Download and save securely

### Share Google Sheet

1. Open your Google Sheet
2. Click Share
3. Add service account email:
   ```
   sheets-integration@YOUR-PROJECT.iam.gserviceaccount.com
   ```
4. Set permission: Viewer

---

## 5. Domain Configuration (cPanel)

### Redirect Setup

To redirect `gauntlet.gallery/authenticate` to your Vercel app:

**Option A: .htaccess**

Create/edit `.htaccess` in `public_html`:
```apache
RewriteEngine On

# Redirect /AUTHENTICATE/xxx to Vercel
RewriteRule ^AUTHENTICATE/(.*)$ https://gauntlet-coa-frontend.vercel.app/AUTHENTICATE/$1 [R=301,L]

# Redirect /authenticate to Vercel
RewriteRule ^authenticate$ https://gauntlet-coa-frontend.vercel.app [R=301,L]
RewriteRule ^authenticate/$ https://gauntlet-coa-frontend.vercel.app [R=301,L]
```

**Option B: cPanel Redirects**

1. cPanel → Redirects
2. Type: Permanent (301)
3. Source: Select domain, enter path `/AUTHENTICATE`
4. Redirect to: `https://gauntlet-coa-frontend.vercel.app/AUTHENTICATE`
5. Wild Card Redirect: Yes

---

## 6. Post-Deployment Checklist

### Verify All Components

| Component | Test | Expected Result |
|-----------|------|-----------------|
| Smart Contract | View on PolygonScan | Contract visible |
| Backend Health | `curl /health` | `{"status":"ok"}` |
| Backend API | `curl /api/verify/TEST` | 404 or COA data |
| Frontend | Visit URL | Page loads |
| QR Scan | Scan test QR | Opens verification |
| Domain Redirect | Visit gauntlet.gallery/AUTHENTICATE/123 | Redirects to Vercel |

### Security Checklist

- [ ] Private key NOT in any repository
- [ ] Environment variables set (not hardcoded)
- [ ] Google credentials JSON not committed
- [ ] CORS configured appropriately
- [ ] HTTPS enabled on all endpoints

---

## Troubleshooting

### Contract Deployment Fails

**"Insufficient funds"**
- Ensure wallet has POL/MATIC tokens
- Check you're on correct network

**"Nonce too low"**
- Wait for pending transactions
- Or reset account in MetaMask

### Backend Issues

**"GOOGLE_CREDENTIALS not set"**
- Verify JSON is single line
- Check for escape characters

**"Spreadsheet not found"**
- Verify SPREADSHEET_ID is correct
- Ensure sheet is shared with service account

### Frontend Issues

**"API URL undefined"**
- Check VITE_API_URL is set in Vercel
- Rebuild after adding variable

**"CORS error"**
- Verify backend CORS allows frontend origin
- Check for trailing slashes in URLs

---

## Updating Deployments

### Backend (Railway)
```bash
git add .
git commit -m "Update description"
git push
# Railway auto-deploys on push
```

### Frontend (Vercel)
```bash
git add .
git commit -m "Update description"
git push
# Vercel auto-deploys on push
```

### Smart Contract
Contracts are immutable. To update:
1. Deploy new contract
2. Update `CONTRACT_ADDRESS` in backend environment
3. Backend will use new contract immediately
