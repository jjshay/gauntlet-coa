# System Architecture

## Overview

The Gauntlet Gallery COA System is a three-tier architecture combining traditional web technologies with blockchain infrastructure to create an immutable, verifiable certificate of authenticity system.

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION TIER                              │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                     React Frontend (Vercel)                          │ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │ │
│  │  │    App.jsx   │  │   QR Scan   │  │   COA Card  │  │   Styles    │ │ │
│  │  │  (Router)    │  │  Component  │  │  Component  │  │   (CSS)     │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │ │
│  │                                                                       │ │
│  │  Features:                                                            │ │
│  │  • Mobile-first responsive design                                     │ │
│  │  • Camera-based QR code scanning (html5-qrcode)                      │ │
│  │  • URL parameter handling (?code=X, /AUTHENTICATE/X)                 │ │
│  │  • Real-time verification status display                              │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS REST API
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION TIER                               │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    Express.js Backend (Railway)                       │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                         API Routes                               │ │ │
│  │  │                                                                  │ │ │
│  │  │  GET /api/verify/:coaCode                                        │ │ │
│  │  │  ├── 1. Query Google Sheets for COA metadata                     │ │ │
│  │  │  ├── 2. Query blockchain for NFT verification                    │ │ │
│  │  │  └── 3. Return combined response                                 │ │ │
│  │  │                                                                  │ │ │
│  │  │  GET /api/image/:coaCode                                         │ │ │
│  │  │  ├── 1. Get image URL from Sheets                                │ │ │
│  │  │  ├── 2. Convert Google Drive URL to direct link                  │ │ │
│  │  │  └── 3. Redirect to image                                        │ │ │
│  │  │                                                                  │ │ │
│  │  │  GET /health                                                     │ │ │
│  │  │  └── Return server status                                        │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                       Service Layer                              │ │ │
│  │  │                                                                  │ │ │
│  │  │  ┌─────────────────┐        ┌─────────────────────────────────┐ │ │ │
│  │  │  │  Google Sheets  │        │     Blockchain Service          │ │ │ │
│  │  │  │    Service      │        │                                 │ │ │ │
│  │  │  │                 │        │  • ethers.js JsonRpcProvider    │ │ │ │
│  │  │  │  • googleapis   │        │  • Contract ABI interface       │ │ │ │
│  │  │  │  • Service Acct │        │  • Read-only verification       │ │ │ │
│  │  │  │    Auth         │        │                                 │ │ │ │
│  │  │  └─────────────────┘        └─────────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                                DATA TIER                                    │
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │   Google Sheets  │  │   Google Drive   │  │   Polygon Blockchain     │ │
│  │                  │  │                  │  │                          │ │
│  │  Artwork Data:   │  │  Media Storage:  │  │  Smart Contract:         │ │
│  │  • COA Code      │  │  • Artwork       │  │  • ERC-721 NFTs          │ │
│  │  • Artist        │  │    Images        │  │  • COA Code → Token ID   │ │
│  │  • Title         │  │  • COA PDFs      │  │  • Ownership Records     │ │
│  │  • Dimensions    │  │                  │  │  • Immutable History     │ │
│  │  • Edition Info  │  │                  │  │                          │ │
│  │  • Provenance    │  │                  │  │  Address:                │ │
│  │                  │  │                  │  │  0xD554...b1b1           │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Verification Request Flow

```
User Scans QR ──► Frontend ──► Backend ──► Google Sheets
      │              │            │              │
      │              │            │              ▼
      │              │            │         Get COA Data
      │              │            │              │
      │              │            ├──────────────┘
      │              │            │
      │              │            ▼
      │              │      Polygon RPC
      │              │            │
      │              │            ▼
      │              │      Verify NFT
      │              │            │
      │              │            ▼
      │              │      Combine Data
      │              │            │
      │              ◄────────────┘
      │              │
      ▼              ▼
   Display COA Certificate
```

### Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| Frontend | User interface, QR scanning | React, Vite |
| Backend | API orchestration, data aggregation | Express.js |
| Google Sheets | Artwork metadata storage | Google API |
| Google Drive | Image/document hosting | Google API |
| Polygon | Immutable ownership proof | Solidity, ethers.js |

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend (Public)                                               │
│  ├── HTTPS only                                                  │
│  ├── No secrets in client code                                   │
│  └── Input sanitization                                          │
│                                                                  │
│  Backend (Secure)                                                │
│  ├── CORS policy                                                 │
│  ├── Environment variables for secrets                          │
│  ├── Service account authentication                              │
│  └── Rate limiting (via Railway)                                 │
│                                                                  │
│  Blockchain (Immutable)                                          │
│  ├── Owner-only minting                                          │
│  ├── OpenZeppelin security patterns                              │
│  └── No private key exposure in API                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Scalability Considerations

### Current Architecture Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Google Sheets | 10M cells | Adequate for ~100k artworks |
| Railway | Auto-scaling | Handles traffic spikes |
| Vercel | Edge network | Global CDN |
| Polygon | 65k+ TPS | No bottleneck |

### Future Scaling Options

1. **Database Migration**: Move from Sheets to PostgreSQL for larger datasets
2. **IPFS Integration**: Decentralized image storage
3. **Caching Layer**: Redis for frequently accessed COAs
4. **Multi-region**: Deploy backend to multiple regions

## Technology Decisions

### Why Polygon?

- **Low fees**: ~$0.01 per transaction vs $5-50 on Ethereum
- **Fast finality**: 2-second block times
- **EVM compatible**: Standard Solidity development
- **Established**: Major NFT marketplaces support Polygon

### Why Google Sheets?

- **Familiar interface**: Gallery staff can manage data easily
- **Real-time updates**: Changes reflect immediately
- **Free tier**: Sufficient for most galleries
- **API access**: Well-documented Google APIs

### Why Separate Frontend/Backend?

- **Scalability**: Independent scaling of each tier
- **Security**: Secrets stay on backend
- **Flexibility**: Easy to swap out components
- **Cost optimization**: Static frontend on CDN
