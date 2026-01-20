# Gauntlet Gallery - Blockchain Certificate of Authenticity System

A full-stack Web3 application that provides blockchain-verified Certificates of Authenticity (COA) for fine art. Built with React, Node.js, Solidity, and deployed on Polygon blockchain.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636.svg)
![React](https://img.shields.io/badge/React-18.x-61DAFB.svg)
![Node](https://img.shields.io/badge/Node.js-18.x-339933.svg)
![Polygon](https://img.shields.io/badge/Polygon-Mainnet-8247E5.svg)

## Live Demo

- **Frontend**: [gauntlet-coa-frontend.vercel.app](https://gauntlet-coa-frontend.vercel.app)
- **Backend API**: [coa.up.railway.app](https://coa.up.railway.app)
- **Smart Contract**: [0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1](https://polygonscan.com/address/0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Smart Contract](#smart-contract)
- [Backend API](#backend-api)
- [Frontend](#frontend)
- [Setup & Installation](#setup--installation)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Security Considerations](#security-considerations)

---

## Overview

This system allows art galleries and collectors to verify artwork authenticity through:

1. **Physical QR Code Stickers** - Applied to artwork, encoding unique COA codes
2. **Blockchain NFTs** - Each COA is minted as an ERC-721 NFT on Polygon
3. **Google Sheets Integration** - Artwork metadata stored in easily manageable spreadsheets
4. **Mobile-First Verification** - Scan QR code → Instant COA with blockchain proof

### User Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Physical Art   │     │   QR Code Scan  │     │  COA Display    │
│  with Sticker   │ ──► │  AUTHENTICATE/  │ ──► │  + Blockchain   │
│  #290745        │     │  290745         │     │  Verification   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                              │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Mobile    │    │   Desktop   │    │   QR Code Scanner   │  │
│  │   Browser   │    │   Browser   │    │   (html5-qrcode)    │  │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘  │
│         │                  │                       │             │
│         └──────────────────┼───────────────────────┘             │
│                            │                                      │
│                            ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              React Frontend (Vite + Vercel)                 │ │
│  │  • Mobile-first responsive design                          │ │
│  │  • QR code scanning with camera access                     │ │
│  │  • Real-time blockchain verification display               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                         API LAYER                                 │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Express.js Backend (Railway)                   │ │
│  │                                                              │ │
│  │  Endpoints:                                                  │ │
│  │  • GET /api/verify/:coaCode - Verify COA + blockchain       │ │
│  │  • GET /api/image/:coaCode  - Proxy artwork images          │ │
│  │  • GET /health              - Health check                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
┌──────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│   Google Sheets  │ │  Google Drive   │ │   Polygon Blockchain    │
│   (Metadata DB)  │ │  (Art Images)   │ │   (NFT Verification)    │
├──────────────────┤ ├─────────────────┤ ├─────────────────────────┤
│ • Artist name    │ │ • High-res      │ │ • ERC-721 Contract      │
│ • Title          │ │   artwork       │ │ • Token ownership       │
│ • Date           │ │   images        │ │ • Immutable records     │
│ • Dimensions     │ │ • COA documents │ │ • Provenance tracking   │
│ • Edition info   │ │                 │ │                         │
│ • COA codes      │ │                 │ │                         │
└──────────────────┘ └─────────────────┘ └─────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework with hooks |
| Vite | Build tool & dev server |
| html5-qrcode | Camera-based QR scanning |
| CSS3 | Custom styling, mobile-first |
| Vercel | Hosting & CDN |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js 18 | Runtime environment |
| Express.js | REST API framework |
| googleapis | Google Sheets integration |
| ethers.js v6 | Blockchain interaction |
| Railway | Hosting & deployment |

### Blockchain
| Technology | Purpose |
|------------|---------|
| Solidity 0.8.20 | Smart contract language |
| OpenZeppelin | Secure contract templates |
| Hardhat | Development & deployment |
| Polygon Mainnet | Low-cost L2 blockchain |

### Data Storage
| Technology | Purpose |
|------------|---------|
| Google Sheets | Artwork metadata database |
| Google Drive | Image hosting |
| Polygon | Immutable ownership records |

---

## Features

### Core Features
- **QR Code Verification** - Scan physical stickers to verify authenticity
- **Blockchain Proof** - NFT-based certificates on Polygon
- **Real-time Lookup** - Instant verification from Google Sheets
- **Mobile Optimized** - Full-screen COA display on phones

### Technical Features
- **Dual Data Source** - Sheets for metadata, blockchain for verification
- **Image Proxy** - Handles Google Drive image URLs
- **Batch Minting** - Mint multiple COAs in one transaction
- **Gas Efficient** - Optimized for Polygon's low fees (~$0.01/mint)

### Security Features
- **Owner-only Minting** - Only contract owner can create COAs
- **Unique Code Enforcement** - Prevents duplicate COA codes
- **Service Account Auth** - Secure Google API access
- **CORS Protection** - API access controls

---

## Project Structure

```
gauntlet-coa/
├── contracts/                 # Solidity smart contracts
│   └── GauntletCOA.sol       # Main ERC-721 COA contract
│
├── scripts/                   # Deployment scripts
│   └── deploy.js             # Hardhat deployment script
│
├── backend/                   # Express.js API server
│   ├── index.js              # Main server file
│   ├── package.json          # Backend dependencies
│   └── .env.example          # Environment template
│
├── frontend/                  # React application
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   ├── App.css           # Styles
│   │   └── main.jsx          # Entry point
│   ├── index.html            # HTML template
│   ├── vite.config.js        # Vite configuration
│   ├── vercel.json           # Vercel deployment config
│   └── package.json          # Frontend dependencies
│
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md       # System architecture details
│   ├── API.md                # API documentation
│   ├── DEPLOYMENT.md         # Deployment guide
│   └── SMART_CONTRACT.md     # Contract documentation
│
├── hardhat.config.js         # Hardhat configuration
├── package.json              # Root dependencies
└── README.md                 # This file
```

---

## Smart Contract

### GauntletCOA.sol

An ERC-721 NFT contract for minting Certificates of Authenticity.

```solidity
// Key functions:
mintCOA(address to, string coaCode, string uri)     // Mint single COA
batchMintCOA(address to, string[] coaCodes, string[] uris)  // Batch mint
isCoaMinted(string coaCode)                         // Check if exists
getTokenIdByCoaCode(string coaCode)                 // Get token ID
getCoaOwner(string coaCode)                         // Get owner address
```

### Contract Details
- **Network**: Polygon Mainnet (Chain ID: 137)
- **Address**: `0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1`
- **Standard**: ERC-721 with URI Storage
- **Gas per Mint**: ~150,000 gas (~$0.01-0.05)

### View on Explorer
[PolygonScan Contract](https://polygonscan.com/address/0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1)

---

## Backend API

### Endpoints

#### `GET /api/verify/:coaCode`
Verify a COA and return all associated data.

**Response:**
```json
{
  "success": true,
  "coa": {
    "code": "290745",
    "artist": "Shepard Fairey",
    "title": "OBEY Giant",
    "date": "2024",
    "dimensions": { "length": "24", "width": "18" },
    "edition": "100",
    "number": "45",
    "history": "Acquired from gallery",
    "imageUrl": "https://drive.google.com/..."
  },
  "blockchain": {
    "verified": true,
    "tokenId": "1",
    "owner": "0x...",
    "contractAddress": "0xD554...",
    "network": "Polygon"
  },
  "verifiedAt": "2024-01-19T12:00:00.000Z"
}
```

#### `GET /api/image/:coaCode`
Proxy endpoint for artwork images (handles Google Drive URLs).

#### `GET /health`
Health check endpoint for monitoring.

---

## Frontend

### Key Components

**App.jsx** - Main application component handling:
- URL parameter parsing (`?code=X` and `/AUTHENTICATE/X`)
- QR code scanning with camera
- API calls and state management
- COA certificate display

### URL Formats Supported
```
https://example.com/?code=290745
https://example.com/AUTHENTICATE/290745
https://example.com/verify/290745
```

### QR Code Format
Physical stickers encode: `AUTHENTICATE/290745`

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- MetaMask wallet (for contract deployment)
- Google Cloud service account

### 1. Clone Repository
```bash
git clone https://github.com/jjshay/gauntlet-coa.git
cd gauntlet-coa
```

### 2. Install Dependencies
```bash
# Root (Hardhat)
npm install

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Environment Setup

**Root `.env`:**
```env
PRIVATE_KEY=your_wallet_private_key
```

**Backend `.env`:**
```env
SPREADSHEET_ID=your_google_sheet_id
SHEET_NAME=COA
GOOGLE_CREDENTIALS={"type":"service_account",...}
POLYGON_RPC=https://polygon.llamarpc.com
CONTRACT_ADDRESS=0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1
PORT=3001
```

**Frontend `.env`:**
```env
VITE_API_URL=https://your-backend-url.com
```

### 4. Run Locally
```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
cd frontend && npm run dev
```

---

## Deployment

### Smart Contract (Polygon)
```bash
npx hardhat run scripts/deploy.js --network polygon
```

### Backend (Railway)
1. Connect GitHub repo to Railway
2. Set environment variables
3. Deploy automatically on push

### Frontend (Vercel)
1. Connect GitHub repo to Vercel
2. Set `VITE_API_URL` environment variable
3. Deploy automatically on push

---

## Google Sheet Setup

Required columns in your COA sheet:

| Column | Description |
|--------|-------------|
| coa_code | Unique code (e.g., 290745) |
| artist | Creator name |
| title | Artwork title |
| date | Year created |
| length | Height in inches |
| width | Width in inches |
| edition | Total edition size |
| number | Edition number |
| history | Provenance info |
| image_url | Google Drive image link |

**Important:** Share sheet with service account email for API access.

---

## Security Considerations

### Smart Contract
- Owner-only minting prevents unauthorized COA creation
- Unique code mapping prevents duplicates
- OpenZeppelin base contracts for battle-tested security

### Backend
- Service account authentication for Google APIs
- No sensitive data exposed in responses
- CORS configured for allowed origins

### Frontend
- No private keys or secrets in client code
- HTTPS enforced
- Input sanitization on COA codes

---

## Future Enhancements

- [ ] Transfer COA ownership with NFT
- [ ] Multi-signature minting for galleries
- [ ] IPFS metadata storage
- [ ] Mobile app with native scanning
- [ ] Secondary market integration

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Author

**John Shay**
- GitHub: [@jjshay](https://github.com/jjshay)

---

## Acknowledgments

- [OpenZeppelin](https://openzeppelin.com/) - Secure smart contract templates
- [Polygon](https://polygon.technology/) - Low-cost blockchain infrastructure
- [Vercel](https://vercel.com/) - Frontend hosting
- [Railway](https://railway.app/) - Backend hosting
