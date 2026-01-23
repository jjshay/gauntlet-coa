/**
 * ============================================================================
 * GAUNTLET GALLERY COA - BACKEND API SERVER
 * ============================================================================
 *
 * Express.js server that provides the API layer for the Certificate of
 * Authenticity verification system. This server acts as the bridge between:
 *
 * 1. Frontend React application
 * 2. Google Sheets (artwork metadata database)
 * 3. Polygon blockchain (NFT verification)
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                         API Server                                   │
 * │                                                                     │
 * │   Frontend ──► /api/verify/:code ──► Google Sheets + Blockchain    │
 * │   Frontend ──► /api/image/:code ──► Google Drive (proxy)           │
 * │   Monitors ──► /health ──► Status check                            │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Deployed: Railway (https://coa.up.railway.app)
 *
 * @author John Shay
 * @version 1.0.0
 */

// ============================================================================
// DEPENDENCIES
// ============================================================================

// Load environment variables from .env file (development only)
require('dotenv').config();

// Express.js - Web framework for Node.js
const express = require('express');

// CORS - Cross-Origin Resource Sharing middleware
// Allows frontend on different domain to access this API
const cors = require('cors');

// Google APIs - Official Google client library
// Used for reading artwork data from Google Sheets
const { google } = require('googleapis');

// Ethers.js v6 - Ethereum library for blockchain interaction
// Used for verifying NFTs on Polygon
const { ethers } = require('ethers');

// ============================================================================
// APPLICATION SETUP
// ============================================================================

// Initialize Express application
const app = express();

// Enable CORS for all origins
// TODO: In production, restrict to specific domains:
// app.use(cors({ origin: ['https://gauntlet.gallery', 'https://gauntlet-coa-frontend.vercel.app'] }));
app.use(cors());

// Parse JSON request bodies
// Enables req.body for POST/PUT requests with JSON content
app.use(express.json());

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Google Sheet containing artwork data
 * Format: 16Kya2WQD0tbXTdsug9zSuoP03XmWXsZRTIykbEbBJBU (from sheet URL)
 */
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

/**
 * Name of the tab/sheet within the spreadsheet
 * Default: 'COA'
 */
const SHEET_NAME = process.env.SHEET_NAME || 'COA';

/**
 * Deployed smart contract address on Polygon
 * This is the GauntletCOA ERC-721 contract
 */
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1';

/**
 * Polygon RPC endpoint for blockchain queries
 * Using public Polygon RPC for mainnet
 */
const POLYGON_RPC = process.env.POLYGON_RPC || 'https://rpc.ankr.com/polygon';

// ============================================================================
// SMART CONTRACT INTERFACE
// ============================================================================

/**
 * Minimal ABI (Application Binary Interface) for the GauntletCOA contract
 *
 * We only include the read-only functions needed for verification:
 * - isCoaMinted: Check if a COA code has been minted
 * - getTokenIdByCoaCode: Get the token ID for a COA code
 * - getCoaOwner: Get the owner address of a COA
 * - tokenURI: Get the metadata URI for a token
 *
 * Full contract ABI not needed since we don't mint from the backend
 */
const CONTRACT_ABI = [
  "function isCoaMinted(string memory coaCode) public view returns (bool)",
  "function getTokenIdByCoaCode(string memory coaCode) public view returns (uint256)",
  "function getCoaOwner(string memory coaCode) public view returns (address)",
  "function tokenURI(uint256 tokenId) public view returns (string memory)"
];

// ============================================================================
// GOOGLE SHEETS INTEGRATION
// ============================================================================

/**
 * Google Sheets API client instance
 * Initialized once at startup, reused for all requests
 */
let sheets;

/**
 * Initialize Google Sheets API client with service account credentials
 *
 * Authentication uses a Google Cloud service account, which allows
 * server-to-server communication without user interaction.
 *
 * The service account email must be given Viewer access to the spreadsheet.
 *
 * @returns {Promise<void>}
 */
async function initGoogleSheets() {
  // Check if credentials are configured
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.log('Warning: GOOGLE_CREDENTIALS not set, Google Sheets disabled');
    return;
  }

  try {
    let credentialsJson = process.env.GOOGLE_CREDENTIALS;

    // Check if credentials are base64 encoded (doesn't start with {)
    if (!credentialsJson.trim().startsWith('{')) {
      console.log('Decoding base64 credentials');
      credentialsJson = Buffer.from(credentialsJson, 'base64').toString('utf8');
    }

    console.log('Parsing credentials...');
    let credentials = JSON.parse(credentialsJson);
    console.log('Parsed successfully, client_email:', credentials.client_email);

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    // Create Sheets API client
    sheets = google.sheets({ version: 'v4', auth });
    console.log('Google Sheets initialized successfully');
  } catch (err) {
    console.error('Failed to init Google Sheets:', err.message);
    console.error('Full error:', err);
  }
}

/**
 * Retrieve COA data from Google Sheets by COA code
 *
 * Searches the spreadsheet for a row matching the given COA code
 * and returns all columns as a key-value object.
 *
 * Sheet Structure Expected:
 * | coa_code | artist | title | date | length | width | edition | number | history | image_url |
 *
 * @param {string} coaCode - The COA code to search for (e.g., "290745")
 * @returns {Promise<Object|null>} - COA data object or null if not found
 *
 * @example
 * const coa = await getCOAFromSheet("290745");
 * // Returns: { coa_code: "290745", artist: "Shepard Fairey", title: "...", ... }
 */
async function getCOAFromSheet(coaCode) {
  // Check if sheets client is initialized
  if (!sheets) {
    throw new Error('Google Sheets not initialized - check GOOGLE_CREDENTIALS');
  }

  // Fetch all data from the sheet (columns A through K)
  // Range format: SheetName!A:K means columns A-K, all rows
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:K`  // Adjust range as needed for more columns
  });

  const rows = response.data.values;

  // Check if sheet has data
  if (!rows || rows.length === 0) return null;

  // First row contains headers - normalize to lowercase with underscores
  // Example: "COA Code" becomes "coa_code"
  const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));

  // Find the index of the coa_code column
  const coaCodeIndex = headers.indexOf('coa_code');

  if (coaCodeIndex === -1) {
    throw new Error('COA_Code column not found in spreadsheet');
  }

  // Search for matching row (skip header row, start at index 1)
  for (let i = 1; i < rows.length; i++) {
    // Compare COA codes (case-insensitive comparison done by caller)
    if (rows[i][coaCodeIndex] === coaCode) {
      // Build object from headers and row values
      const coaData = {};
      headers.forEach((header, index) => {
        coaData[header] = rows[i][index] || '';  // Default to empty string if cell is empty
      });
      return coaData;
    }
  }

  // No matching row found
  return null;
}

// ============================================================================
// BLOCKCHAIN VERIFICATION
// ============================================================================

/**
 * Verify NFT status on Polygon blockchain
 *
 * Checks if a COA code has been minted as an NFT and retrieves
 * ownership and metadata information.
 *
 * @param {string} coaCode - The COA code to verify
 * @returns {Promise<Object>} - Verification result object
 *
 * @example
 * // NFT exists:
 * { verified: true, tokenId: "1", owner: "0x...", tokenURI: "ipfs://...", ... }
 *
 * // NFT not minted:
 * { verified: false, reason: "NFT not minted for this COA" }
 */
async function verifyNFT(coaCode) {
  // Check if contract is configured
  if (!CONTRACT_ADDRESS) {
    return { verified: false, reason: 'Contract not deployed yet' };
  }

  try {
    // Create read-only connection to Polygon network
    // JsonRpcProvider is for HTTP-based connections
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC);

    // Create contract instance with provider (read-only, no signer needed)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // Check if this COA code has been minted
    const isMinted = await contract.isCoaMinted(coaCode);

    if (!isMinted) {
      return { verified: false, reason: 'NFT not minted for this COA' };
    }

    // COA is minted - fetch additional details
    const tokenId = await contract.getTokenIdByCoaCode(coaCode);
    const owner = await contract.getCoaOwner(coaCode);
    const tokenURI = await contract.tokenURI(tokenId);

    return {
      verified: true,
      tokenId: tokenId.toString(),  // Convert BigInt to string for JSON
      owner,
      tokenURI,
      contractAddress: CONTRACT_ADDRESS,
      network: 'Polygon'
    };
  } catch (error) {
    // Return error as unverified status
    // Common errors: network issues, contract not found, RPC rate limit
    return { verified: false, reason: error.message };
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health Check Endpoint
 * GET /health
 *
 * Used by:
 * - Railway for deployment health checks
 * - Monitoring systems
 * - Manual verification that server is running
 *
 * @returns {Object} { status: "ok", timestamp: "ISO date string" }
 */
app.get('/health', (req, res) => {
  let parseError = null;
  let clientEmail = null;
  try {
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
    clientEmail = creds.client_email || 'not found';
  } catch (e) {
    parseError = e.message;
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sheetsReady: !!sheets,
    credentialsSet: !!process.env.GOOGLE_CREDENTIALS,
    credentialsLength: process.env.GOOGLE_CREDENTIALS?.length || 0,
    parseError: parseError,
    clientEmail: clientEmail
  });
});

/**
 * COA Verification Endpoint
 * GET /api/verify/:coaCode
 *
 * Main endpoint for verifying artwork authenticity. Combines data from
 * Google Sheets (metadata) and Polygon blockchain (NFT verification).
 *
 * @param {string} coaCode - URL parameter, the COA code to verify
 *
 * @returns {Object} Combined verification response:
 * {
 *   success: true,
 *   coa: { code, artist, title, date, dimensions, edition, number, history, imageUrl },
 *   blockchain: { verified, tokenId?, owner?, tokenURI?, contractAddress?, network? },
 *   verifiedAt: "ISO timestamp"
 * }
 *
 * @example
 * GET /api/verify/290745
 */
app.get('/api/verify/:coaCode', async (req, res) => {
  try {
    const { coaCode } = req.params;

    // Validate input
    if (!coaCode) {
      return res.status(400).json({ error: 'COA code is required' });
    }

    // Normalize COA code to uppercase for consistent matching
    const normalizedCode = coaCode.toUpperCase();

    // Step 1: Get COA data from Google Sheets
    const coaData = await getCOAFromSheet(normalizedCode);

    if (!coaData) {
      return res.status(404).json({
        error: 'COA not found',
        code: coaCode
      });
    }

    // Step 2: Verify on blockchain
    const blockchainStatus = await verifyNFT(normalizedCode);

    // Step 3: Build and return response
    // Map various possible column names to our standard fields
    const response = {
      success: true,
      coa: {
        code: normalizedCode,
        artist: coaData.artist || coaData.ARTIST || '',
        title: coaData.title || coaData.Title || '',
        date: coaData.date || coaData.year || coaData.Year || '',
        dimensions: {
          length: coaData.length || coaData['c:_item_length'] || coaData['c:_art_l'] || '',
          width: coaData.width || coaData['c:_item_width'] || coaData['c:_art_w'] || ''
        },
        edition: coaData.edition || coaData.Edition || '',
        number: coaData.number || coaData.Number || '',
        history: coaData.history || coaData.description || coaData.Description || '',
        imageUrl: coaData.image_url || coaData.thumbnail || coaData.THUMBNAIL || ''
      },
      blockchain: blockchainStatus,
      verifiedAt: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    // Log error for debugging (visible in Railway logs)
    console.error('Verification error:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Image Proxy Endpoint
 * GET /api/image/:coaCode
 *
 * Retrieves the artwork image URL from the sheet and redirects to it.
 * Handles Google Drive URL conversion for direct image access.
 *
 * Why a proxy?
 * - Google Drive links don't work directly in <img> tags
 * - Abstracts storage location from frontend
 * - Could add caching/CDN in the future
 *
 * @param {string} coaCode - URL parameter, the COA code
 *
 * @returns Redirect (302) to the image URL
 */
app.get('/api/image/:coaCode', async (req, res) => {
  try {
    const { coaCode } = req.params;

    // Get COA data to find image URL
    const coaData = await getCOAFromSheet(coaCode.toUpperCase());

    if (!coaData || !coaData.image_url) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Convert Google Drive sharing link to direct download URL
    // Input formats:
    //   https://drive.google.com/file/d/FILE_ID/view
    //   https://drive.google.com/open?id=FILE_ID
    // Output format:
    //   https://drive.google.com/uc?export=view&id=FILE_ID
    let imageUrl = coaData.image_url;

    if (imageUrl.includes('drive.google.com')) {
      // Extract file ID using regex
      const fileId = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
        || imageUrl.match(/id=([a-zA-Z0-9_-]+)/)?.[1];

      if (fileId) {
        // Convert to direct view URL
        imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }

    // Redirect to the image URL
    // 302 = temporary redirect (allows URL to change in future)
    res.redirect(imageUrl);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

/**
 * NFT Metadata Endpoint (OpenSea Compatible)
 * GET /api/nft/:coaCode
 *
 * Returns NFT metadata in OpenSea-compatible format for wallets and marketplaces.
 *
 * @param {string} coaCode - URL parameter, the COA code
 *
 * @returns {Object} OpenSea-compatible metadata:
 * {
 *   name: "COA #291045 - Title",
 *   description: "Certificate of Authenticity...",
 *   image: "https://...",
 *   external_url: "https://...",
 *   attributes: [...]
 * }
 */
app.get('/api/nft/:coaCode', async (req, res) => {
  try {
    const { coaCode } = req.params;
    const normalizedCode = coaCode.toUpperCase();

    // Get COA data from Google Sheets
    const coaData = await getCOAFromSheet(normalizedCode);

    if (!coaData) {
      return res.status(404).json({ error: 'COA not found' });
    }

    // Build image URL
    let imageUrl = coaData.image_url || '';
    if (imageUrl.includes('drive.google.com')) {
      const fileId = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
        || imageUrl.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
      if (fileId) {
        imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }

    // Build COA page screenshot URL for NFT image
    const coaPageUrl = `https://frontend-pi-three-98.vercel.app/verify/${normalizedCode}`;
    const screenshotUrl = `https://image.thum.io/get/width/800/crop/1000/noanimate/${coaPageUrl}`;

    // Build OpenSea-compatible metadata
    const metadata = {
      name: `COA #${normalizedCode} - ${coaData.title || 'Untitled'}`,
      description: `Certificate of Authenticity for "${coaData.title || 'Untitled'}" by ${coaData.artist || 'Unknown Artist'}. ${coaData.history || coaData.description || ''}`.trim(),
      image: screenshotUrl,
      external_url: coaPageUrl,
      attributes: [
        { trait_type: "Artist", value: coaData.artist || 'Unknown' },
        { trait_type: "Title", value: coaData.title || 'Untitled' },
        { trait_type: "Year", value: coaData.date || coaData.year || 'Unknown' },
        { trait_type: "Dimensions", value: `${coaData.length || '?'}" x ${coaData.width || '?'}"` },
        { trait_type: "COA Code", value: normalizedCode }
      ]
    };

    // Add edition info if available
    if (coaData.edition) {
      metadata.attributes.push({ trait_type: "Edition", value: `${coaData.number || '?'} of ${coaData.edition}` });
    }

    res.json(metadata);
  } catch (error) {
    console.error('NFT metadata error:', error);
    res.status(500).json({ error: 'Failed to fetch NFT metadata' });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Server port - defaults to 3001 for local development
 * Railway sets PORT environment variable automatically
 */
const PORT = process.env.PORT || 3001;

/**
 * Initialize services and start the server
 *
 * Startup sequence:
 * 1. Initialize Google Sheets connection
 * 2. Start Express server
 * 3. If Sheets fails, server still starts (graceful degradation)
 */
initGoogleSheets()
  .then(() => {
    // Start server, binding to 0.0.0.0 for container environments
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Gauntlet COA API running on port ${PORT}`);
    });
  })
  .catch(err => {
    // Log warning but still start server
    // This allows health checks to pass while troubleshooting Sheets
    console.error('Warning:', err.message);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Gauntlet COA API running on port ${PORT} (without Google Sheets)`);
    });
  });
