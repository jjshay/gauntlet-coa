# Smart Contract Documentation

## Contract Overview

**Name**: GauntletCOA
**Symbol**: GCOA
**Standard**: ERC-721 (NFT)
**Solidity Version**: 0.8.20
**Network**: Polygon Mainnet
**Address**: `0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1`

## Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GauntletCOA                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Inherits From:                                                  │
│  ├── ERC721 (OpenZeppelin)          - NFT standard              │
│  ├── ERC721URIStorage (OpenZeppelin) - Token URI storage        │
│  └── Ownable (OpenZeppelin)          - Access control           │
│                                                                  │
│  State Variables:                                                │
│  ├── _nextTokenId (uint256)          - Auto-incrementing ID     │
│  ├── coaCodeToTokenId (mapping)      - COA code → Token ID      │
│  └── tokenIdToCoaCode (mapping)      - Token ID → COA code      │
│                                                                  │
│  Functions:                                                      │
│  ├── mintCOA()          - Mint single COA (owner only)          │
│  ├── batchMintCOA()     - Mint multiple COAs (owner only)       │
│  ├── isCoaMinted()      - Check if COA exists                   │
│  ├── getTokenIdByCoaCode() - Get token ID from COA code         │
│  ├── getCoaOwner()      - Get owner of a COA                    │
│  ├── tokenURI()         - Get metadata URI                      │
│  └── supportsInterface() - ERC-165 interface detection          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Functions

### Constructor

```solidity
constructor() ERC721("Gauntlet Gallery COA", "GCOA") Ownable(msg.sender)
```

Initializes the contract with:
- Token name: "Gauntlet Gallery COA"
- Token symbol: "GCOA"
- Sets deployer as contract owner

---

### mintCOA

Mint a new Certificate of Authenticity NFT.

```solidity
function mintCOA(
    address to,
    string memory coaCode,
    string memory uri
) public onlyOwner returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| to | address | Recipient wallet address |
| coaCode | string | Unique COA identifier (e.g., "290745") |
| uri | string | Metadata URI (IPFS or HTTP) |

**Returns:** `uint256` - The minted token ID

**Requirements:**
- Caller must be contract owner
- COA code cannot be empty
- COA code must not already exist

**Example:**
```solidity
// Mint COA #290745 to gallery wallet
mintCOA(
    0x1234567890abcdef1234567890abcdef12345678,
    "290745",
    "ipfs://QmXxx.../metadata.json"
);
```

**Events Emitted:**
```solidity
event COAMinted(uint256 indexed tokenId, string coaCode, address indexed owner);
```

---

### batchMintCOA

Mint multiple COAs in a single transaction.

```solidity
function batchMintCOA(
    address to,
    string[] memory coaCodes,
    string[] memory uris
) public onlyOwner
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| to | address | Recipient wallet address |
| coaCodes | string[] | Array of COA codes |
| uris | string[] | Array of metadata URIs (must match coaCodes length) |

**Requirements:**
- Caller must be contract owner
- Arrays must be same length
- All COA codes must be unique and non-empty

**Example:**
```solidity
// Batch mint 3 COAs
string[] memory codes = new string[](3);
codes[0] = "290756";
codes[1] = "290757";
codes[2] = "290758";

string[] memory uris = new string[](3);
uris[0] = "ipfs://Qm.../290756.json";
uris[1] = "ipfs://Qm.../290757.json";
uris[2] = "ipfs://Qm.../290758.json";

batchMintCOA(galleryWallet, codes, uris);
```

**Gas Optimization:**
- More efficient than individual mintCOA calls
- Saves ~20% gas for batches of 10+ NFTs

---

### isCoaMinted

Check if a COA code has been minted.

```solidity
function isCoaMinted(string memory coaCode) public view returns (bool)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| coaCode | string | The COA code to check |

**Returns:** `bool` - True if minted, false otherwise

**Example:**
```solidity
bool exists = contract.isCoaMinted("290745");
// returns: true
```

---

### getTokenIdByCoaCode

Get the token ID associated with a COA code.

```solidity
function getTokenIdByCoaCode(string memory coaCode) public view returns (uint256)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| coaCode | string | The COA code |

**Returns:** `uint256` - The token ID

**Reverts:** If COA code not found

**Example:**
```solidity
uint256 tokenId = contract.getTokenIdByCoaCode("290745");
// returns: 1
```

---

### getCoaOwner

Get the current owner of a COA by its code.

```solidity
function getCoaOwner(string memory coaCode) public view returns (address)
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| coaCode | string | The COA code |

**Returns:** `address` - Owner's wallet address

**Reverts:** If COA code not found

**Example:**
```solidity
address owner = contract.getCoaOwner("290745");
// returns: 0x1234...5678
```

---

## Events

### COAMinted

Emitted when a new COA NFT is minted.

```solidity
event COAMinted(
    uint256 indexed tokenId,
    string coaCode,
    address indexed owner
);
```

**Parameters:**
| Name | Type | Indexed | Description |
|------|------|---------|-------------|
| tokenId | uint256 | Yes | The minted token ID |
| coaCode | string | No | The COA code |
| owner | address | Yes | The token recipient |

---

## Storage Layout

```
Slot 0-6: ERC721 base storage
Slot 7:   _nextTokenId (uint256)
Slot 8:   coaCodeToTokenId (mapping: string => uint256)
Slot 9:   tokenIdToCoaCode (mapping: uint256 => string)
```

## Gas Estimates

| Function | Estimated Gas | Cost (@ 30 gwei, $0.50/MATIC) |
|----------|---------------|-------------------------------|
| mintCOA | ~150,000 | ~$0.002 |
| batchMintCOA (10) | ~1,200,000 | ~$0.018 |
| isCoaMinted | ~25,000 | View (free) |
| getTokenIdByCoaCode | ~25,000 | View (free) |
| getCoaOwner | ~30,000 | View (free) |

---

## Security Considerations

### Access Control
- Only the contract owner can mint new COAs
- Ownership can be transferred via `transferOwnership()`
- Consider multi-sig wallet for owner address

### Input Validation
- Empty COA codes are rejected
- Duplicate COA codes are rejected
- Array length mismatch in batch mint is rejected

### Upgradeability
- Contract is NOT upgradeable (intentional for immutability)
- To upgrade, deploy new contract and migrate data

### Auditing
- Built on OpenZeppelin v5.x contracts
- Standard ERC-721 implementation
- No custom cryptographic functions

---

## Deployment

### Using Hardhat

```bash
# Set environment variables
export PRIVATE_KEY=your_private_key

# Deploy to Polygon mainnet
npx hardhat run scripts/deploy.js --network polygon
```

### Using Remix

1. Open [Remix IDE](https://remix.ethereum.org)
2. Create `GauntletCOA.sol` and paste contract code
3. Compile with Solidity 0.8.20+
4. Connect MetaMask to Polygon network
5. Deploy via "Injected Provider"

---

## Verification

Verify contract on PolygonScan:

```bash
npx hardhat verify --network polygon 0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1
```

---

## ABI (Application Binary Interface)

Minimal ABI for read operations (used by backend):

```json
[
  "function isCoaMinted(string memory coaCode) public view returns (bool)",
  "function getTokenIdByCoaCode(string memory coaCode) public view returns (uint256)",
  "function getCoaOwner(string memory coaCode) public view returns (address)",
  "function tokenURI(uint256 tokenId) public view returns (string memory)"
]
```

Full ABI available in `artifacts/contracts/GauntletCOA.sol/GauntletCOA.json`

---

## Integration Example

### ethers.js v6

```javascript
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1';
const ABI = [
  'function isCoaMinted(string) view returns (bool)',
  'function getTokenIdByCoaCode(string) view returns (uint256)',
  'function getCoaOwner(string) view returns (address)',
  'function tokenURI(uint256) view returns (string)'
];

const provider = new ethers.JsonRpcProvider('https://polygon.llamarpc.com');
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Check if COA is minted
const isMinted = await contract.isCoaMinted('290745');
console.log('Is minted:', isMinted);

// Get token details
if (isMinted) {
  const tokenId = await contract.getTokenIdByCoaCode('290745');
  const owner = await contract.getCoaOwner('290745');
  const uri = await contract.tokenURI(tokenId);

  console.log('Token ID:', tokenId.toString());
  console.log('Owner:', owner);
  console.log('URI:', uri);
}
```
