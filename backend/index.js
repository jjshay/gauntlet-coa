/**
 * ============================================================================
 * TRUECOA - BACKEND API SERVER
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

// Load environment variables from .env files (development only)
// Root .env carries Hardhat/Polygon signing config, backend/.env carries API config.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
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
// app.use(cors({ origin: ['https://truecoa.com', 'https://gauntlet-coa-frontend.vercel.app'] }));
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
const POLYGON_RPC = process.env.POLYGON_RPC || 'https://1rpc.io/matic';

/**
 * ScoreDetect API configuration.
 * The API key must stay server-side; the frontend only asks this backend
 * to create a record when the operator checks the ScoreDetect option.
 */
const SCOREDETECT_API_URL = process.env.SCOREDETECT_API_URL || 'https://api.scoredetect.com';
const SCOREDETECT_VERIFICATION_BASE_URL = process.env.SCOREDETECT_VERIFICATION_BASE_URL || 'https://scoredetect.com/verify/';

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
  "function tokenURI(uint256 tokenId) public view returns (string memory)",
  "function mintCOA(address to, string memory coaCode, string memory uri) public returns (uint256)"
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
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
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
    range: `${SHEET_NAME}!A:AZ`  // All columns including any new additions
  });

  const rows = response.data.values;

  // Check if sheet has data
  if (!rows || rows.length === 0) return null;

  // First row contains headers - normalize to lowercase with underscores
  // Example: "COA Code" becomes "coa_code"
  // Handle duplicate column names by appending _2, _3, etc.
  const rawHeaders = rows[0].map(h => String(h)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, ''));
  const headerCount = {};
  const headers = rawHeaders.map(h => {
    headerCount[h] = (headerCount[h] || 0) + 1;
    return headerCount[h] > 1 ? `${h}_${headerCount[h]}` : h;
  });
  console.log('Sheet headers (deduplicated):', headers);

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

function normalizeHeader(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function dedupeHeaders(rawHeaders) {
  const headerCount = {};
  return rawHeaders.map(header => {
    const normalized = normalizeHeader(header);
    headerCount[normalized] = (headerCount[normalized] || 0) + 1;
    return headerCount[normalized] > 1 ? `${normalized}_${headerCount[normalized]}` : normalized;
  });
}

function normalizeCOACreatePayload(body = {}) {
  const rawCode = body.coaCode || body.code || body.coa_code || `TC-${Date.now()}`;
  const coaCode = String(rawCode).trim().toUpperCase();
  const length = String(body.length || '').trim();
  const width = String(body.width || '').trim();
  const dimensions = String(body.dimensions || body.size || (length && width ? `${length} x ${width}` : '')).trim();

  return {
    coaCode,
    qrCode: String(body.qrCode || body.qr_code || '').trim(),
    signer: String(body.signer || body.artist || '').trim(),
    title: String(body.title || '').trim(),
    date: String(body.date || body.artDate || body.year || '').trim(),
    length,
    width,
    dimensions,
    authenticator: String(body.authenticator || '').trim(),
    authenticatorNumber: String(body.authenticatorNumber || body.authNumber || body.number || '').trim(),
    authenticatorDate: String(body.authenticatorDate || body.authDate || '').trim(),
    authenticatorLink: String(body.authenticatorLink || body.thirdPartyCoaLink || body.third_party_coa_link || '').trim(),
    authNotes: String(body.authNotes || '').trim(),
    condition: String(body.condition || '').trim(),
    description: String(body.description || '').trim(),
    provenance: String(body.provenance || body.providence || '').trim(),
    edition: String(body.edition || '').trim(),
    medium: String(body.medium || '').trim(),
    assignor: String(body.assignor || body.authenticator || '').trim(),
    assignee: String(body.assignee || '').trim(),
    imageUrl: String(body.imageUrl || body.image_url || '').trim(),
    sku: String(body.sku || '').trim(),
    nftTokenId: String(body.nftTokenId || body.nft_tokenid || '').trim(),
    shortUrl: String(body.shortUrl || body.short_url || '').trim(),
    blockchainUrl: String(body.blockchainUrl || body.blockchain_url || '').trim(),
    nftUrl: String(body.nftUrl || body.nft_url || '').trim(),
    certUrl: String(body.certUrl || body.cert_url || '').trim(),
    status: String(body.status || '[pending]').trim(),
    completionDate: String(body.completionDate || body.completion_date || new Date().toISOString().slice(0, 10)).trim()
  };
}

function valueForSheetHeader(header, row) {
  const values = {
    coa_code: row.coaCode,
    qr_code: row.qrCode,
    signer: row.signer,
    artist: row.signer,
    title: row.title,
    date: row.date,
    date_2: row.authenticatorDate,
    length: row.length,
    width: row.width,
    size: row.dimensions,
    dimensions: row.dimensions,
    authenticator: row.authenticator,
    number: row.authenticatorNumber,
    authenticator_number: row.authenticatorNumber,
    authenticator_date: row.authenticatorDate,
    third_party_coa_link: row.authenticatorLink,
    third_party_authentication_notes: row.authNotes,
    condition: row.condition,
    description: row.description,
    provenance: row.provenance,
    providence: row.provenance,
    edition: row.edition,
    medium: row.medium,
    assignor: row.assignor,
    assignee: row.assignee,
    image_url: row.imageUrl,
    sku: row.sku,
    nft_tokenid: row.nftTokenId,
    short_url: row.shortUrl,
    blockchain_url: row.blockchainUrl,
    nft_url: row.nftUrl,
    cert_url: row.certUrl,
    status: row.status,
    completion_date: row.completionDate
  };

  return values[header] || '';
}

async function appendCOAToSheet(row) {
  if (!sheets) {
    throw new Error('Google Sheets not initialized - check GOOGLE_CREDENTIALS');
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!1:1`
  });

  const rawHeaders = headerResponse.data.values?.[0] || [];
  if (!rawHeaders.length) {
    throw new Error('Google Sheet header row is empty');
  }

  const headers = dedupeHeaders(rawHeaders);
  const values = headers.map(header => valueForSheetHeader(header, row));

  const appendResponse = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:AZ`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] }
  });

  return appendResponse.data.updates || {};
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
    let tokenURI = '';
    try {
      tokenURI = await contract.tokenURI(tokenId);
    } catch (e) {
      // tokenURI may not be set - that's OK
      console.log('tokenURI not available for token', tokenId.toString());
    }

    return {
      verified: true,
      tokenId: tokenId.toString(),
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

function getMetadataUri(coaCode) {
  const base = process.env.METADATA_BASE_URL || 'https://coa.up.railway.app/api/nft';
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(coaCode)}`;
}

function getPublicApiBaseUrl(req) {
  const configured = process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, '');

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol || 'https';
  const host = forwardedHost || req.get('host');
  return `${protocol}://${host}`;
}

function getPublicFrontendBaseUrl() {
  return (process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'https://truecoa.com').replace(/\/$/, '');
}

function getCertificateImageUrl(req, coaCode) {
  return `${getPublicApiBaseUrl(req)}/api/coa-image/${encodeURIComponent(coaCode)}.svg`;
}

function getCertificatePageUrl(coaCode) {
  return `${getPublicFrontendBaseUrl()}/AUTHENTICATE/${encodeURIComponent(coaCode)}`;
}

function stripImageExtension(coaCode) {
  return String(coaCode || '').replace(/\.(svg|png|jpg|jpeg)$/i, '').toUpperCase();
}

function svgEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(value, maxChars = 52, maxLines = 6) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';

  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\.*$/, '')}...`;
  }

  return lines;
}

function fieldValue(coaData, names, fallback = '') {
  for (const name of names) {
    if (coaData[name]) return coaData[name];
  }
  return fallback;
}

function buildCOAFields(normalizedCode, coaData) {
  const artist = fieldValue(coaData, ['signer', 'artist', 'Artist']);
  const title = fieldValue(coaData, ['title', 'Title'], 'Untitled');
  const description = fieldValue(coaData, ['description', 'Description']);
  const provenance = fieldValue(coaData, ['providence', 'provenance', 'notes_providence']);
  const medium = fieldValue(coaData, ['medium', 'Medium']);
  const condition = fieldValue(coaData, ['condition', 'Condition']);
  const size = fieldValue(coaData, ['size', 'dimensions']);
  const edition = fieldValue(coaData, ['edition', 'edition_', 'Edition']);
  const year = fieldValue(coaData, ['date', 'Date', 'year']);
  const imageUrl = fieldValue(coaData, ['image_url', 'Image_URL']);
  const sku = fieldValue(coaData, ['sku', 'SKU']);
  const assignor = fieldValue(coaData, ['assignor', 'authenticator']);
  const assignee = fieldValue(coaData, ['assignee']);
  const authNotes = fieldValue(coaData, ['third_party_authentication_notes', 'auth_notes']);
  const completionDate = fieldValue(coaData, ['completion_date']);
  const qrCodeUrl = fieldValue(coaData, ['qr_code']);
  const shortUrl = fieldValue(coaData, ['short_url']);
  const blockchainUrl = fieldValue(coaData, ['blockchain_url']);
  const nftUrl = fieldValue(coaData, ['nft_url']);
  const certUrl = fieldValue(coaData, ['cert_url']);
  const authenticator = fieldValue(coaData, ['authenticator']);
  const authenticatorNumber = fieldValue(coaData, ['authenticator_number', 'number']);
  const authenticatorDate = fieldValue(coaData, ['authenticator_date']);
  const authenticatorLink = fieldValue(coaData, ['third_party_coa_link', 'authenticator_link']);

  return {
    code: normalizedCode,
    artist,
    title,
    description,
    provenance,
    medium,
    condition,
    size,
    edition,
    year,
    imageUrl,
    sku,
    assignor,
    assignee,
    authNotes,
    completionDate,
    qrCodeUrl,
    shortUrl,
    blockchainUrl,
    nftUrl,
    certUrl,
    authenticator,
    authenticatorNumber,
    authenticatorDate,
    authenticatorLink
  };
}

function buildNftDescription(fields) {
  let nftDescription = `Certificate of Authenticity for "${fields.title}" by ${fields.artist || 'Unknown artist'}.`;
  if (fields.year) nftDescription += ` Created in ${fields.year}.`;
  if (fields.medium) nftDescription += `\n\nMedium: ${fields.medium}`;
  if (fields.size) nftDescription += `\nSize: ${fields.size}`;
  if (fields.edition) nftDescription += `\nEdition: ${fields.edition}`;
  if (fields.condition) nftDescription += `\nCondition: ${fields.condition}`;
  if (fields.description) nftDescription += `\n\n${fields.description}`;
  if (fields.provenance) nftDescription += `\n\nProvenance: ${fields.provenance}`;
  nftDescription += '\n\nThis NFT represents the TrueCOA certificate image and permanent Polygon record for the physical artwork.';
  return nftDescription.trim();
}

function buildNftAttributes(fields) {
  const attributes = [
    { trait_type: 'Signer', value: fields.artist || 'Unknown' },
    { trait_type: 'Title', value: fields.title },
    { trait_type: 'COA Code', value: fields.code }
  ];
  if (fields.year) attributes.push({ trait_type: 'Year', value: fields.year });
  if (fields.medium) attributes.push({ trait_type: 'Medium', value: fields.medium });
  if (fields.size) attributes.push({ trait_type: 'Size', value: fields.size });
  if (fields.edition) attributes.push({ trait_type: 'Edition', value: fields.edition });
  if (fields.condition) attributes.push({ trait_type: 'Condition', value: fields.condition });
  if (fields.assignor) attributes.push({ trait_type: 'Assignor', value: fields.assignor });
  if (fields.assignee) attributes.push({ trait_type: 'Assignee', value: fields.assignee });
  attributes.push({ trait_type: 'Verified By', value: 'TrueCOA' });
  attributes.push({ trait_type: 'Blockchain', value: 'Polygon' });
  return attributes;
}

function buildCertificateSvg(fields, urls) {
  const titleLines = wrapText(fields.title, 28, 2);
  const descriptionLines = wrapText(fields.description || 'Certificate record generated by TrueCOA.', 58, 6);
  const provenanceLines = wrapText(fields.provenance || '', 58, 4);
  const verifyLines = wrapText(urls.certificatePageUrl, 54, 2);
  const rows = [
    ['Artist', fields.artist],
    ['Date', fields.year],
    ['Medium', fields.medium],
    ['Dimensions', fields.size],
    ['Edition', fields.edition],
    ['Condition', fields.condition],
    ['SKU', fields.sku]
  ].filter(([, value]) => value);
  const artwork = urls.artworkUrl
    ? `<image href="${svgEscape(urls.artworkUrl)}" x="96" y="282" width="600" height="520" preserveAspectRatio="xMidYMid meet" />`
    : `<rect x="96" y="282" width="600" height="520" rx="12" fill="#f4f0e7" stroke="#d9cfb8" stroke-dasharray="12 12" />
       <text x="396" y="552" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#8b7b55" letter-spacing="2">ARTWORK IMAGE</text>`;

  const titleText = titleLines.map((line, index) =>
    `<text x="800" y="${128 + (index * 54)}" text-anchor="middle" font-family="Georgia, serif" font-size="${index ? 42 : 50}" font-weight="700" fill="#183321">${svgEscape(line)}</text>`
  ).join('');

  const rowText = rows.map(([label, value], index) => {
    const y = 308 + (index * 43);
    return `<text x="792" y="${y}" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#355e3b" letter-spacing="1.5">${svgEscape(label.toUpperCase())}</text>
      <text x="1092" y="${y}" font-family="Arial, sans-serif" font-size="24" fill="#1a1a1a">${svgEscape(value)}</text>`;
  }).join('');

  const descriptionText = descriptionLines.map((line, index) =>
    `<text x="792" y="${657 + (index * 30)}" font-family="Arial, sans-serif" font-size="24" fill="#282820">${svgEscape(line)}</text>`
  ).join('');

  const provenanceText = provenanceLines.map((line, index) =>
    `<text x="792" y="${878 + (index * 28)}" font-family="Arial, sans-serif" font-size="22" fill="#3d3d35">${svgEscape(line)}</text>`
  ).join('');

  const verifyText = verifyLines.map((line, index) =>
    `<text x="1032" y="${1032 + (index * 22)}" font-family="Arial, sans-serif" font-size="16" fill="#766c55">${svgEscape(line)}</text>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1131" viewBox="0 0 1600 1131" role="img" aria-label="TrueCOA certificate ${svgEscape(fields.code)}">
  <defs>
    <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#fffdf7"/>
      <stop offset="100%" stop-color="#f3efe5"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" x2="1">
      <stop offset="0%" stop-color="#a88721"/>
      <stop offset="50%" stop-color="#e4c45a"/>
      <stop offset="100%" stop-color="#a88721"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1131" fill="#0d1a12"/>
  <rect x="40" y="40" width="1520" height="1051" rx="18" fill="url(#paper)"/>
  <rect x="70" y="70" width="1460" height="991" rx="8" fill="none" stroke="#c9a227" stroke-width="4"/>
  <text x="800" y="104" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#c9a227" letter-spacing="9">CERTIFICATE OF AUTHENTICITY</text>
  ${titleText}
  <rect x="88" y="218" width="620" height="666" rx="16" fill="#ffffff" stroke="#d8d1bf" stroke-width="2"/>
  ${artwork}
  <rect x="88" y="914" width="620" height="90" rx="14" fill="#183321"/>
  <text x="124" y="957" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#c9a227" letter-spacing="2">TRUECOA ID</text>
  <text x="124" y="986" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${svgEscape(fields.code)}</text>
  <rect x="748" y="236" width="740" height="314" rx="16" fill="#ffffff" stroke="#d8d1bf" stroke-width="2"/>
  ${rowText}
  <rect x="748" y="590" width="740" height="208" rx="16" fill="#ffffff" stroke="#d8d1bf" stroke-width="2"/>
  <text x="792" y="630" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#355e3b" letter-spacing="2">DESCRIPTION</text>
  ${descriptionText}
  <rect x="748" y="826" width="740" height="148" rx="16" fill="#ffffff" stroke="#d8d1bf" stroke-width="2"/>
  <text x="792" y="862" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#355e3b" letter-spacing="2">PROVENANCE</text>
  ${provenanceText || `<text x="792" y="908" font-family="Arial, sans-serif" font-size="22" fill="#8b8372">Recorded in the TrueCOA registry.</text>`}
  <rect x="748" y="1006" width="740" height="46" rx="12" fill="#f1ead7" stroke="#d8d1bf" stroke-width="1"/>
  <text x="792" y="1034" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#355e3b" letter-spacing="1.5">VERIFY</text>
  ${verifyText}
  <rect x="70" y="182" width="1460" height="18" fill="url(#gold)"/>
  <text x="760" y="1076" text-anchor="end" font-family="Arial, sans-serif" font-size="18" fill="#6d634d">Rendered COA image for Polygon NFT metadata</text>
  <text x="1488" y="1076" text-anchor="end" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#355e3b">Transparent Authenticity</text>
</svg>`;
}

async function mintCOAOnPolygon({ coaCode, metadataUri, recipient }) {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is not configured for Polygon minting');
  }

  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(normalizedKey, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  const receiver = recipient || wallet.address;

  const alreadyMinted = await contract.isCoaMinted(coaCode);
  if (alreadyMinted) {
    const tokenId = await contract.getTokenIdByCoaCode(coaCode);
    const owner = await contract.getCoaOwner(coaCode);
    return {
      status: 'already_minted',
      tokenId: tokenId.toString(),
      owner,
      contractAddress: CONTRACT_ADDRESS,
      blockchainUrl: `https://polygonscan.com/token/${CONTRACT_ADDRESS}?a=${tokenId.toString()}`,
      nftUrl: `https://opensea.io/assets/matic/${CONTRACT_ADDRESS}/${tokenId.toString()}`
    };
  }

  const tx = await contract.mintCOA(receiver, coaCode, metadataUri);
  const receipt = await tx.wait();
  const tokenId = await contract.getTokenIdByCoaCode(coaCode);
  const owner = await contract.getCoaOwner(coaCode);

  return {
    status: 'minted',
    tokenId: tokenId.toString(),
    owner,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    contractAddress: CONTRACT_ADDRESS,
    blockchainUrl: `https://polygonscan.com/token/${CONTRACT_ADDRESS}?a=${tokenId.toString()}`,
    transactionUrl: `https://polygonscan.com/tx/${tx.hash}`,
    nftUrl: `https://opensea.io/assets/matic/${CONTRACT_ADDRESS}/${tokenId.toString()}`
  };
}

// ============================================================================
// SCOREDETECT INTEGRATION
// ============================================================================

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
  );
}

function buildScoreDetectMetadata(row) {
  const createdAt = new Date().toISOString();
  return compactObject({
    type: 'certificate_of_authenticity',
    certificateProvider: 'TrueCOA',
    coaCode: row.coaCode,
    signer: row.signer,
    artist: row.signer,
    title: row.title,
    artDate: row.date,
    medium: row.medium,
    dimensions: row.dimensions,
    edition: row.edition,
    condition: row.condition,
    description: row.description,
    provenance: row.provenance,
    assignor: row.assignor,
    assignee: row.assignee,
    sku: row.sku,
    imageUrl: row.imageUrl,
    polygonContract: CONTRACT_ADDRESS,
    createdAt,
    uniqueId: `truecoa_${row.coaCode}_${Date.now()}`
  });
}

async function readJsonResponse(response, context) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = data.error || data.message || response.statusText || 'Unknown error';
    throw new Error(`${context} failed: ${response.status} ${message}`);
  }

  return data;
}

function appendVerificationId(baseUrl, id) {
  if (!id) return '';
  return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(id)}`;
}

async function createScoreDetectRecord(row) {
  const apiKey = process.env.SCOREDETECT_API_KEY;
  if (!apiKey) {
    throw new Error('SCOREDETECT_API_KEY is not configured for ScoreDetect records');
  }

  const baseUrl = SCOREDETECT_API_URL.replace(/\/$/, '');
  const metadata = buildScoreDetectMetadata(row);
  const metadataJson = JSON.stringify(metadata);

  const checksumForm = new FormData();
  if (typeof Blob === 'function') {
    checksumForm.append(
      'file',
      new Blob([metadataJson], { type: 'application/json' }),
      `${row.coaCode}.json`
    );
  } else {
    checksumForm.append('file', metadataJson);
  }

  const checksumResponse = await fetch(`${baseUrl}/generate-checksum`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: checksumForm
  });
  const checksumData = await readJsonResponse(checksumResponse, 'ScoreDetect checksum generation');
  const checksum = checksumData.checksum || checksumData.hash;
  if (!checksum) {
    throw new Error('ScoreDetect checksum generation did not return a checksum');
  }

  const certificateForm = new FormData();
  certificateForm.append('hash', checksum);

  const certificateResponse = await fetch(`${baseUrl}/create-certificate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: certificateForm
  });
  const certificate = await readJsonResponse(certificateResponse, 'ScoreDetect certificate creation');
  const certId = certificate.id || certificate.certificateId || certificate.certId || '';
  const transactionUrl = certificate.transactionUrl || certificate.txUrl || certificate.blockchainUrl || '';

  return {
    status: 'created',
    certId: certId ? String(certId) : '',
    checksum,
    verificationUrl: certificate.verificationUrl || appendVerificationId(SCOREDETECT_VERIFICATION_BASE_URL, certId),
    blockchainUrl: transactionUrl,
    transactionUrl,
    createdAt: metadata.createdAt
  };
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
function sendHealth(req, res) {
  let clientEmail = null;
  try {
    let raw = process.env.GOOGLE_CREDENTIALS || '{}';
    if (!raw.trim().startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
    const creds = JSON.parse(raw);
    clientEmail = creds.client_email || 'not found';
  } catch (e) {
    clientEmail = 'parse error: ' + e.message;
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sheetsReady: !!sheets,
    credentialsSet: !!process.env.GOOGLE_CREDENTIALS,
    clientEmail: clientEmail
  });
}

app.get('/', sendHealth);
app.get('/health', sendHealth);
app.get('/api/health', sendHealth);

app.post('/api/create', async (req, res) => {
  try {
    const row = normalizeCOACreatePayload(req.body);
    if (!row.coaCode) {
      return res.status(400).json({ error: 'COA code is required' });
    }
    if (!row.title || !row.signer) {
      return res.status(400).json({ error: 'Title and signer/artist are required' });
    }

    const metadataUri = getMetadataUri(row.coaCode);
    let polygon = null;
    let scoreDetect = null;
    const operationErrors = [];

    if (req.body.createScoreDetect) {
      try {
        scoreDetect = await createScoreDetectRecord(row);
        row.certUrl = scoreDetect.verificationUrl || row.certUrl;
        row.status = '[scoredetect created]';
      } catch (error) {
        operationErrors.push({ service: 'ScoreDetect', message: error.message });
      }
    }

    if (req.body.mintPolygon) {
      try {
        polygon = await mintCOAOnPolygon({
          coaCode: row.coaCode,
          metadataUri,
          recipient: req.body.recipient
        });

        row.nftTokenId = polygon.tokenId || '';
        row.blockchainUrl = polygon.blockchainUrl || '';
        row.nftUrl = polygon.nftUrl || '';
        row.status = polygon.status === 'already_minted' ? '[already minted]' : '[complete]';
      } catch (error) {
        operationErrors.push({ service: 'Polygon', message: error.message });
      }
    }

    if (operationErrors.length && !scoreDetect && !polygon) {
      row.status = '[created with warnings]';
    }

    row.certUrl = row.certUrl || metadataUri;
    row.shortUrl = row.shortUrl || metadataUri;

    let sheet = null;
    try {
      sheet = await appendCOAToSheet(row);
    } catch (sheetError) {
      return res.status(207).json({
        success: true,
        warning: 'COA created but Google Sheet append failed',
        sheetError: sheetError.message,
        coa: row,
        scoreDetect,
        polygon,
        operationErrors,
        metadataUri
      });
    }

    res.status(operationErrors.length ? 207 : 201).json({
      success: true,
      warning: operationErrors.length ? 'COA record created with warnings' : undefined,
      coa: row,
      scoreDetect,
      polygon,
      operationErrors,
      metadataUri,
      sheet
    });
  } catch (error) {
    console.error('Create COA error:', error);
    res.status(500).json({
      error: 'Failed to create COA',
      message: error.message
    });
  }
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

    // Static fallback metadata for known minted tokens (used when Google Sheets is unavailable)
    const FALLBACK_METADATA = {
      '291046': {
        artist: 'Shepard Fairey', title: 'Lenin Record', date: '2005',
        dimensions: '24" x 18"', edition: '101 of 300', medium: 'Drawing on Heavy Matte Paper',
        condition: 'Very good', sku: '1_Obey_Lenin-Record_P',
        description: 'Felt-tip drawing on heavy paper depicting actor James Dean. Preparatory drawing for the Japanese ads series.',
        provenance: 'Acquired by Executor of Warhol\'s Estate Fredrick Hughes and subsequently sold to the grandfather of the current owner, where upon the passing of said grandfather, the current owner, grandchild inherited the work.'
      },
      '291047': {
        artist: 'Shepard Fairey', title: 'Rose Soldier', date: '2017',
        dimensions: '13" x 10"', edition: '2 of 450', medium: '',
        condition: '', sku: '2_Obey_Rose-Soldier_P',
        description: '', provenance: ''
      },
      '291048': {
        artist: 'Shepard Fairey', title: 'Chinese Soldiers', date: '2006',
        dimensions: '24" x 18"', edition: '3 of 300', medium: '',
        condition: '', sku: '3_Obey_Chinese-Soldiers_P',
        description: '', provenance: ''
      },
      'W1': {
        artist: 'Andy Warhol', title: 'Rebel Without a Cause (James Dean)', date: '1985',
        dimensions: '', edition: 'Unique', medium: 'Felt-tip drawing on heavy matte paper',
        condition: 'Very good', sku: 'W1_Warhol_James-Dean_L',
        description: 'Felt-tip drawing on heavy paper depicting actor James Dean. Preparatory drawing for the Japanese ads series Andy Warhol Rebel Without a Cause (James Dean) from the 1985 Ad Series.',
        provenance: 'Acquired by Executor of Warhol\'s Estate Fredrick Hughes and subsequently sold to the grandfather of the current owner, where upon the passing of said grandfather, the current owner, grandchild inherited the work.'
      }
    };

    // Step 1: Get COA data from Google Sheets (with fallback)
    let coaData = null;
    try {
      coaData = await getCOAFromSheet(normalizedCode);
    } catch (sheetErr) {
      console.error('Google Sheets error, using fallback:', sheetErr.message);
    }

    // Use fallback if Sheets failed or returned nothing
    if (!coaData) {
      const fallback = FALLBACK_METADATA[normalizedCode];
      if (!fallback) {
        return res.status(404).json({ error: 'COA not found', code: coaCode });
      }
      coaData = {
        signer: fallback.artist,
        title: fallback.title,
        date: fallback.date,
        size: fallback.dimensions,
        edition: fallback.edition,
        medium: fallback.medium,
        condition: fallback.condition,
        description: fallback.description,
        providence: fallback.provenance,
        image_url: ''
      };
    }

    // Step 2: Verify on blockchain
    const blockchainStatus = await verifyNFT(normalizedCode);

    // Step 3: Build and return response
    // Map column names to standard fields
    // COA sheet headers (normalized):
    // coa_code, qr_code, signer, title, date, medium, edition, size, condition,
    // description, providence, assignor, assignee, third_party_authentication_notes,
    // sku, image_url, nft_tokenid, short_url, blockchain_url, nft_url, cert_url,
    // status, completion_date
    const artist = coaData.signer || coaData.artist || coaData.Artist || '';
    const title = coaData.title || coaData.Title || 'Untitled';
    const description = coaData.description || coaData.Description || '';
    const provenance = coaData.providence || coaData.provenance || coaData.notes_providence || '';
    const medium = coaData.medium || coaData.Medium || '';
    const condition = coaData.condition || coaData.Condition || '';
    const size = coaData.size || coaData.dimensions || '';
    const edition = coaData.edition || coaData.edition_ || coaData.Edition || '';
    const year = coaData.date || coaData.Date || coaData.year || '';
    const imageUrl = coaData.image_url || coaData.Image_URL || '';
    const sku = coaData.sku || coaData.SKU || '';
    const assignor = coaData.assignor || coaData.authenticator || '';
    const assignee = coaData.assignee || '';
    const authNotes = coaData.third_party_authentication_notes || coaData.auth_notes || '';
    const completionDate = coaData.completion_date || '';
    const qrCodeUrl = coaData.qr_code || '';
    const shortUrl = coaData.short_url || '';
    const blockchainUrl = coaData.blockchain_url || '';
    const nftUrl = coaData.nft_url || '';
    const certUrl = coaData.cert_url || '';
    const authenticator = coaData.authenticator || '';
    const authenticatorNumber = coaData.authenticator_number || coaData.number || '';
    const authenticatorDate = coaData.authenticator_date || '';
    const authenticatorLink = coaData.third_party_coa_link || coaData.authenticator_link || '';

    // NFT marketplaces should show the certificate itself as the media,
    // not only the underlying artwork image.
    const certificateImageUrl = getCertificateImageUrl(req, normalizedCode);
    const certificatePageUrl = getCertificatePageUrl(normalizedCode);

    // Build rich description from all available COA fields
    let nftDescription = `Certificate of Authenticity for "${title}" by ${artist}.`;
    if (year) nftDescription += ` Created in ${year}.`;
    if (medium) nftDescription += `\n\nMedium: ${medium}`;
    if (size) nftDescription += `\nSize: ${size}`;
    if (edition) nftDescription += `\nEdition: ${edition}`;
    if (condition) nftDescription += `\nCondition: ${condition}`;
    if (description) nftDescription += `\n\n${description}`;
    if (provenance) nftDescription += `\n\nProvenance: ${provenance}`;
    nftDescription += `\n\nThis certificate is cryptographically secured on the Polygon blockchain and linked to a unique NFT. Verified by TrueCOA.`;

    // Build attributes array with all available fields
    const attributes = [
      { trait_type: "Signer", value: artist || 'Unknown' },
      { trait_type: "Title", value: title },
      { trait_type: "COA Code", value: normalizedCode }
    ];
    if (year) attributes.push({ trait_type: "Year", value: year });
    if (medium) attributes.push({ trait_type: "Medium", value: medium });
    if (size) attributes.push({ trait_type: "Size", value: size });
    if (edition) attributes.push({ trait_type: "Edition", value: edition });
    if (condition) attributes.push({ trait_type: "Condition", value: condition });
    if (assignor) attributes.push({ trait_type: "Assignor", value: assignor });
    attributes.push({ trait_type: "Verified By", value: "TrueCOA" });
    attributes.push({ trait_type: "Blockchain", value: "Polygon" });

    const response = {
      // === ERC-721 Metadata fields (for OpenSea/NFT marketplaces) ===
      name: `TrueCOA - ${title}`,
      description: nftDescription.trim(),
      image: certificateImageUrl,
      image_url: certificateImageUrl,
      animation_url: certificatePageUrl,
      external_url: certificatePageUrl,
      attributes,
      // === Legacy fields (for frontend app) ===
      success: true,
      coa: {
        code: normalizedCode,
        artist,
        title,
        date: year,
        completionDate,
        size,
        edition,
        medium,
        condition,
        description,
        provenance,
        assignor,
        assignee,
        authNotes,
        authenticator,
        authenticatorNumber,
        authenticatorDate,
        authenticatorLink,
        qrCodeUrl,
        shortUrl,
        blockchainUrl,
        nftUrl,
        certUrl,
        sku,
        imageUrl: imageUrl
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
 * Certificate Media Endpoint
 * GET /api/coa-image/:coaCode.svg
 *
 * Returns a rendered certificate image for NFT marketplaces. Polygon/OpenSea
 * read this from the token metadata `image` field, so the first visible asset
 * is the actual COA rather than the raw artwork image.
 */
app.get('/api/coa-image/:coaCode', async (req, res) => {
  try {
    const normalizedCode = stripImageExtension(req.params.coaCode);
    if (!normalizedCode) {
      return res.status(400).send('COA code is required');
    }

    const coaData = await getCOAFromSheet(normalizedCode);
    if (!coaData) {
      return res.status(404).send('COA not found');
    }

    const fields = buildCOAFields(normalizedCode, coaData);
    const artworkUrl = fields.imageUrl && !fields.imageUrl.includes('#REF')
      ? `${getPublicApiBaseUrl(req)}/api/image/${encodeURIComponent(normalizedCode)}`
      : '';
    const svg = buildCertificateSvg(fields, {
      artworkUrl,
      certificatePageUrl: getCertificatePageUrl(normalizedCode)
    });

    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (error) {
    console.error('Certificate image error:', error);
    res.status(500).send('Failed to render certificate image');
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

    // Proxy the image bytes instead of redirecting
    // Google Drive sets cross-origin-embedder-policy: require-corp
    // which blocks <img> tags on other domains from loading via redirect
    const imageResponse = await fetch(imageUrl, { redirect: 'follow' });

    if (!imageResponse.ok) {
      return res.status(502).json({ error: 'Failed to fetch image from source' });
    }

    // Forward content-type and cache for 1 hour
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');

    // Pipe the image stream to the response
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    res.send(buffer);
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

    const fields = buildCOAFields(normalizedCode, coaData);
    const certificateImageUrl = getCertificateImageUrl(req, normalizedCode);
    const certificatePageUrl = getCertificatePageUrl(normalizedCode);

    // Build OpenSea-compatible metadata
    const metadata = {
      name: `TrueCOA #${normalizedCode} - ${fields.title}`,
      description: buildNftDescription(fields),
      image: certificateImageUrl,
      image_url: certificateImageUrl,
      animation_url: certificatePageUrl,
      external_url: certificatePageUrl,
      background_color: 'F8F5EF',
      attributes: buildNftAttributes(fields),
      properties: {
        category: 'Certificate of Authenticity',
        files: [
          {
            uri: certificateImageUrl,
            type: 'image/svg+xml'
          }
        ],
        certificate: {
          code: normalizedCode,
          verificationUrl: certificatePageUrl,
          artworkImageUrl: fields.imageUrl || ''
        }
      }
    };

    res.set('Cache-Control', 'public, max-age=300');
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
      console.log(`TrueCOA API running on port ${PORT}`);
    });
  })
  .catch(err => {
    // Log warning but still start server
    // This allows health checks to pass while troubleshooting Sheets
    console.error('Warning:', err.message);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`TrueCOA API running on port ${PORT} (without Google Sheets)`);
    });
  });
