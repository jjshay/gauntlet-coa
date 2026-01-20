# API Documentation

## Base URL

**Production**: `https://coa.up.railway.app`

**Local Development**: `http://localhost:3001`

---

## Endpoints

### Health Check

Check if the API server is running.

```
GET /health
```

**Response** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-19T12:00:00.000Z"
}
```

---

### Verify COA

Verify a Certificate of Authenticity and retrieve all associated data.

```
GET /api/verify/:coaCode
```

**Parameters**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| coaCode | string | URL path | Yes | The unique COA code (e.g., "290745") |

**Success Response** `200 OK`

```json
{
  "success": true,
  "coa": {
    "code": "290745",
    "artist": "Shepard Fairey",
    "title": "OBEY Giant - Peace Fingers",
    "date": "2024",
    "dimensions": {
      "length": "24",
      "width": "18"
    },
    "edition": "100",
    "number": "45",
    "history": "Acquired directly from Obey Giant studio",
    "imageUrl": "https://drive.google.com/file/d/xxx/view"
  },
  "blockchain": {
    "verified": true,
    "tokenId": "1",
    "owner": "0x1234567890abcdef1234567890abcdef12345678",
    "tokenURI": "ipfs://QmXxx...",
    "contractAddress": "0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1",
    "network": "Polygon"
  },
  "verifiedAt": "2024-01-19T12:00:00.000Z"
}
```

**Blockchain Not Minted Response** `200 OK`

When COA exists in database but NFT hasn't been minted yet:

```json
{
  "success": true,
  "coa": {
    "code": "290746",
    "artist": "KAWS",
    "title": "Companion",
    "date": "2023",
    "dimensions": {
      "length": "12",
      "width": "12"
    },
    "edition": "500",
    "number": "123",
    "history": "",
    "imageUrl": ""
  },
  "blockchain": {
    "verified": false,
    "reason": "NFT not minted for this COA"
  },
  "verifiedAt": "2024-01-19T12:00:00.000Z"
}
```

**Error Responses**

`400 Bad Request` - Missing COA code
```json
{
  "error": "COA code is required"
}
```

`404 Not Found` - COA not found in database
```json
{
  "error": "COA not found",
  "code": "INVALID123"
}
```

`500 Internal Server Error` - Server error
```json
{
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

---

### Get Image

Retrieve artwork image by COA code. Handles Google Drive URL conversion.

```
GET /api/image/:coaCode
```

**Parameters**

| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| coaCode | string | URL path | Yes | The unique COA code |

**Success Response** `302 Redirect`

Redirects to the direct image URL.

**Error Responses**

`404 Not Found` - Image not found
```json
{
  "error": "Image not found"
}
```

`500 Internal Server Error`
```json
{
  "error": "Failed to fetch image"
}
```

---

## Request Examples

### cURL

```bash
# Health check
curl https://coa.up.railway.app/health

# Verify COA
curl https://coa.up.railway.app/api/verify/290745

# Get image (follows redirect)
curl -L https://coa.up.railway.app/api/image/290745 --output artwork.jpg
```

### JavaScript (Fetch)

```javascript
// Verify COA
async function verifyCOA(code) {
  const response = await fetch(`https://coa.up.railway.app/api/verify/${code}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error);
  }

  return data;
}

// Usage
try {
  const result = await verifyCOA('290745');
  console.log('Artist:', result.coa.artist);
  console.log('Blockchain verified:', result.blockchain.verified);
} catch (error) {
  console.error('Verification failed:', error.message);
}
```

### Python (Requests)

```python
import requests

def verify_coa(code):
    response = requests.get(f'https://coa.up.railway.app/api/verify/{code}')
    response.raise_for_status()
    return response.json()

# Usage
result = verify_coa('290745')
print(f"Artist: {result['coa']['artist']}")
print(f"Blockchain verified: {result['blockchain']['verified']}")
```

---

## Response Field Descriptions

### COA Object

| Field | Type | Description |
|-------|------|-------------|
| code | string | Unique COA identifier |
| artist | string | Artist/creator name |
| title | string | Artwork title |
| date | string | Year or date created |
| dimensions.length | string | Height in inches |
| dimensions.width | string | Width in inches |
| edition | string | Total edition size (e.g., "100") |
| number | string | Edition number (e.g., "45") |
| history | string | Provenance/ownership history |
| imageUrl | string | URL to artwork image |

### Blockchain Object

| Field | Type | Description |
|-------|------|-------------|
| verified | boolean | Whether NFT exists on blockchain |
| tokenId | string | NFT token ID (if minted) |
| owner | string | Current NFT owner address (if minted) |
| tokenURI | string | Metadata URI (if minted) |
| contractAddress | string | Smart contract address |
| network | string | Blockchain network name |
| reason | string | Reason if not verified |

---

## Rate Limiting

The API does not currently implement rate limiting at the application level. Railway's infrastructure provides basic DDoS protection.

For production use with high traffic, consider:
- Implementing rate limiting middleware
- Adding API key authentication
- Using a caching layer

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "message": "Technical details (optional)",
  "code": "Related identifier (optional)"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 302 | Redirect (image endpoint) |
| 400 | Bad request (invalid input) |
| 404 | Resource not found |
| 500 | Server error |

---

## CORS

The API allows cross-origin requests from any origin (`*`). For production, consider restricting to specific domains:

```javascript
app.use(cors({
  origin: ['https://gauntlet.gallery', 'https://gauntlet-coa-frontend.vercel.app']
}));
```
