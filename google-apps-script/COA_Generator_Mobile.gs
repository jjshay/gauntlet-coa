/**
 * GAUNTLET GALLERY - COA GENERATOR
 * Updated to match final Canva template design
 *
 * SETUP:
 * 1. Open Google Sheet: https://docs.google.com/spreadsheets/d/16Kya2WQD0tbXTdsug9zSuoP03XmWXsZRTIykbEbBJBU
 * 2. Go to Extensions > Apps Script
 * 3. Delete existing code, paste this entire file
 * 4. Click Save, then Run > onOpen
 * 5. Authorize when prompted
 * 6. Refresh sheet - menu will appear
 */

// === CONFIGURATION ===
const BITLY_KEY = '485a216ca4141d6f381d6d16bf1ae5ef33a4e49e';
const VERIFY_URL = 'https://gauntlet-coa-frontend.vercel.app';
const SHEET_NAME = 'COA';
const FOLDER_NAME = 'Gauntlet COA Certificates';

// Column indices (0-based) - Updated to match actual sheet structure
const COL = {
  CODE: 0,        // A: COA_Code
  QR: 1,          // B: QR_Code
  ARTIST: 2,      // C: Artist
  TITLE: 3,       // D: Title
  DATE: 4,        // E: Date (artwork year)
  LENGTH: 5,      // F: Length
  WIDTH: 6,       // G: Width
  NUMBER: 7,      // H: Number
  EDITION: 8,     // I: Edition
  ASSIGNEE: 9,    // J: Assignee (buyer)
  IMAGE: 10,      // K: Image_URL
  SKU: 11,        // L: SKU
  COA_CODE2: 12,  // M: COA_Code (duplicate)
  NFT_TOKEN: 13,  // N: NFT_TokenID
  SHORT: 14,      // O: Short_URL
  BLOCKCHAIN: 15, // P: Blockchain_URL
  NFT_URL: 16,    // Q: NFT_URL
  CERT: 17,       // R: Cert_URL
  DONE: 18        // S: Done
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎨 COA Generator')
    .addItem('📱 Digital - Mobile', 'generateMobile')
    .addItem('📄 PDF (Large View)', 'generatePDF')
    .addSeparator()
    .addItem('Generate All Certificates', 'generateAll')
    .addItem('Generate Selected Row', 'generateRow')
    .addSeparator()
    .addItem('Create Short Links Only', 'shortLinksOnly')
    .addItem('Preview Certificate HTML', 'previewCert')
    .addSeparator()
    .addItem('Test Bit.ly', 'testBitly')
    .addItem('Setup Folders', 'setupFolders')
    .addToUi();
}

/**
 * Generate Mobile/Digital view for selected row
 */
function generateMobile() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = sheet.getActiveRange().getRow();
  if (row <= 1) { SpreadsheetApp.getUi().alert('Select a data row'); return; }

  const data = sheet.getRange(row, 1, 1, 19).getValues()[0];
  const code = String(data[COL.CODE]).trim();
  const folder = getFolder();

  const certData = buildCertData(data);
  const html = generateMobileHTML(certData);

  const mobileFile = folder.createFile(`COA_Mobile_${code}.html`, html, MimeType.HTML);

  SpreadsheetApp.getUi().alert('📱 Mobile Certificate Created',
    `Open this URL on your phone or desktop:\n\n${mobileFile.getUrl()}`,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Generate PDF/Large view for selected row
 */
function generatePDF() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = sheet.getActiveRange().getRow();
  if (row <= 1) { SpreadsheetApp.getUi().alert('Select a data row'); return; }

  const data = sheet.getRange(row, 1, 1, 19).getValues()[0];
  const code = String(data[COL.CODE]).trim();
  const folder = getFolder();

  const certData = buildCertData(data);
  const html = generatePDFHTML(certData);

  // Create HTML file
  const htmlFile = folder.createFile(`COA_PDF_${code}.html`, html, MimeType.HTML);

  // Convert to PDF
  const pdfBlob = htmlFile.getAs(MimeType.PDF);
  pdfBlob.setName(`COA_${code}_${certData.artist.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`);
  const pdfFile = folder.createFile(pdfBlob);

  SpreadsheetApp.getUi().alert('📄 PDF Certificate Created',
    `HTML Preview: ${htmlFile.getUrl()}\n\nPDF Download: ${pdfFile.getUrl()}`,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Build certificate data from row
 */
function buildCertData(data) {
  const code = String(data[COL.CODE]).trim();
  const today = new Date();
  const transactionDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const short = data[COL.SHORT] || `${VERIFY_URL}/AUTHENTICATE/${code}`;

  return {
    code: code,
    short: short,
    qr: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(short)}`,
    artist: data[COL.ARTIST] || 'Unknown Artist',
    title: data[COL.TITLE] || 'Untitled',
    year: data[COL.DATE] || '',
    dims: data[COL.LENGTH] && data[COL.WIDTH] ? `${data[COL.WIDTH]}" x ${data[COL.LENGTH]}"` : '-',
    edition: data[COL.NUMBER] && data[COL.EDITION] ? `${data[COL.NUMBER]} of ${data[COL.EDITION]}` : '-',
    assignee: data[COL.ASSIGNEE] || '-',
    image: data[COL.IMAGE] || '',
    transactionDate: transactionDate,
    blockchainUrl: data[COL.BLOCKCHAIN] || short,
    nftUrl: data[COL.NFT_URL] || short
  };
}

function generateAll() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "COA" not found'); return; }

  const data = sheet.getDataRange().getValues();
  const folder = getFolder();
  let count = 0, errors = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][COL.CODE] || data[i][COL.DONE]) continue;
    try {
      process(sheet, i + 1, data[i], folder);
      count++;
      Utilities.sleep(600);
    } catch(e) {
      errors.push(`Row ${i+1}: ${e.message}`);
      Logger.log(`Error row ${i+1}: ${e.message}`);
    }
  }

  let msg = `✅ Generated ${count} certificates`;
  if (errors.length > 0) msg += `\n\n⚠️ ${errors.length} errors:\n${errors.slice(0,5).join('\n')}`;
  SpreadsheetApp.getUi().alert('Complete', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function generateRow() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = sheet.getActiveRange().getRow();
  if (row <= 1) { SpreadsheetApp.getUi().alert('Select a data row'); return; }

  const data = sheet.getRange(row, 1, 1, 19).getValues()[0];
  const folder = getFolder();
  const result = process(sheet, row, data, folder);

  SpreadsheetApp.getUi().alert('✅ Certificate Generated!',
    `HTML: ${result.htmlUrl}\n\nPDF: ${result.pdfUrl}\n\nImage URL in sheet: ${data[COL.IMAGE] || '(empty)'}`,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function process(sheet, row, data, folder) {
  const code = String(data[COL.CODE]).trim();
  if (!code) return;

  const longUrl = `${VERIFY_URL}/AUTHENTICATE/${code}`;
  const short = bitly(longUrl, code) || longUrl;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(short)}`;

  // Get transaction date (use today's date)
  const today = new Date();
  const transactionDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const certData = {
    code: code,
    short: short,
    qr: qr,
    artist: data[COL.ARTIST] || 'Unknown Artist',
    title: data[COL.TITLE] || 'Untitled',
    year: data[COL.DATE] || '',
    dims: data[COL.LENGTH] && data[COL.WIDTH] ? `${data[COL.WIDTH]}" x ${data[COL.LENGTH]}"` : '-',
    edition: data[COL.NUMBER] && data[COL.EDITION] ? `${data[COL.NUMBER]} of ${data[COL.EDITION]}` : '-',
    assignee: data[COL.ASSIGNEE] || '-',
    image: data[COL.IMAGE] || '',
    transactionDate: transactionDate,
    blockchainUrl: data[COL.BLOCKCHAIN] || short,
    nftUrl: data[COL.NFT_URL] || short
  };

  // Create HTML certificate
  const html = generateCertHTML(certData);

  // Save HTML version
  const htmlFile = folder.createFile(`COA_${code}.html`, html, MimeType.HTML);

  // Also create PDF version
  const pdfBlob = htmlFile.getAs(MimeType.PDF);
  pdfBlob.setName(`COA_${code}_${certData.artist.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`);
  const pdfFile = folder.createFile(pdfBlob);

  // Update sheet
  sheet.getRange(row, COL.QR + 1).setValue(qr);
  sheet.getRange(row, COL.SHORT + 1).setValue(short);
  sheet.getRange(row, COL.CERT + 1).setValue(htmlFile.getUrl());
  sheet.getRange(row, COL.DONE + 1).setValue(new Date().toISOString());

  Logger.log(`Generated: ${code} -> ${htmlFile.getUrl()}`);

  return {
    htmlUrl: htmlFile.getUrl(),
    pdfUrl: pdfFile.getUrl()
  };
}

function bitly(url, code) {
  try {
    const res = UrlFetchApp.fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${BITLY_KEY}`, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ long_url: url, title: `COA-${code}` }),
      muteHttpExceptions: true
    });
    const json = JSON.parse(res.getContentText());
    if (res.getResponseCode() < 300) return json.link;
    Logger.log(`Bitly error: ${JSON.stringify(json)}`);
    return null;
  } catch(e) {
    Logger.log(`Bitly exception: ${e.message}`);
    return null;
  }
}

function shortLinksOnly() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    if (!data[i][COL.CODE] || data[i][COL.SHORT]) continue;
    const short = bitly(`${VERIFY_URL}/AUTHENTICATE/${data[i][COL.CODE]}`, data[i][COL.CODE]);
    if (short) {
      sheet.getRange(i + 1, COL.SHORT + 1).setValue(short);
      count++;
    }
    Utilities.sleep(600);
  }
  SpreadsheetApp.getUi().alert(`Created ${count} short links`);
}

function previewCert() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = sheet.getActiveRange().getRow();
  if (row <= 1) { SpreadsheetApp.getUi().alert('Select a data row'); return; }

  const data = sheet.getRange(row, 1, 1, 19).getValues()[0];
  const code = String(data[COL.CODE]).trim();
  const today = new Date();
  const transactionDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const certData = {
    code: code || 'SAMPLE',
    short: data[COL.SHORT] || `${VERIFY_URL}/AUTHENTICATE/${code}`,
    qr: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(VERIFY_URL)}`,
    artist: data[COL.ARTIST] || 'Sample Artist',
    title: data[COL.TITLE] || 'Sample Artwork',
    year: data[COL.DATE] || '2025',
    dims: data[COL.LENGTH] && data[COL.WIDTH] ? `${data[COL.WIDTH]}" x ${data[COL.LENGTH]}"` : '24" x 18"',
    edition: data[COL.NUMBER] && data[COL.EDITION] ? `${data[COL.NUMBER]} of ${data[COL.EDITION]}` : '1 of 50',
    assignee: data[COL.ASSIGNEE] || 'Collector Name',
    image: data[COL.IMAGE] || 'https://via.placeholder.com/400x500?text=Artwork+Image',
    transactionDate: transactionDate,
    blockchainUrl: data[COL.BLOCKCHAIN] || 'https://bit.ly/blockchain',
    nftUrl: data[COL.NFT_URL] || 'https://bit.ly/nft'
  };

  const html = generateCertHTML(certData);
  const folder = getFolder();
  const preview = folder.createFile(`preview_${code || 'sample'}.html`, html, MimeType.HTML);

  SpreadsheetApp.getUi().alert('Preview Created',
    `Open this URL to preview:\n\n${preview.getUrl()}`,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function testBitly() {
  const result = bitly('https://example.com/test', 'TEST');
  SpreadsheetApp.getUi().alert(result ? `✅ Working!\n\nShort URL: ${result}` : '❌ Failed - check API key in script');
}

function setupFolders() {
  const folder = getFolder();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);

  SpreadsheetApp.getUi().alert('Setup Complete',
    `✅ Drive Folder: ${folder.getName()}\n   ${folder.getUrl()}\n\n` +
    `✅ Sheet: ${sheet ? sheet.getName() : 'NOT FOUND'}\n` +
    `   Rows: ${sheet ? sheet.getLastRow() - 1 : 0}\n\n` +
    `✅ Bit.ly API: Configured\n` +
    `✅ Verify URL: ${VERIFY_URL}`,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function getFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}

/**
 * Generate certificate HTML matching the approved Canva template design
 */
function generateCertHTML(d) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Authenticity - ${esc(d.code)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Source+Sans+Pro:ital,wght@0,400;0,600;1,400&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Source Sans Pro', sans-serif;
      background: #e8e8e8;
      padding: 20px;
      min-height: 100vh;
    }

    .certificate {
      background: #fff;
      max-width: 900px;
      margin: 0 auto;
      border: 4px solid #6b5b95;
      padding: 40px;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header h1 {
      font-family: 'Cinzel', serif;
      font-size: 34px;
      font-weight: 600;
      color: #c9a962;
      letter-spacing: 8px;
      text-transform: uppercase;
    }

    .content {
      display: flex;
      gap: 40px;
      margin-bottom: 30px;
    }

    .artwork {
      flex: 0 0 340px;
    }

    .artwork img {
      width: 100%;
      height: auto;
      display: block;
    }

    .details-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }

    .detail-label {
      font-weight: 600;
      color: #c9a962;
      font-size: 15px;
    }

    .detail-value {
      color: #333;
      font-size: 15px;
      text-align: right;
    }

    .section-spacer {
      height: 30px;
    }

    .footer {
      border-top: 1px solid #eee;
      padding-top: 25px;
      padding-bottom: 0px;
    }

    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .footer-left {
      flex: 1;
    }

    .provenance {
      font-style: italic;
      font-size: 14px;
      color: #555;
      line-height: 1.6;
      margin-bottom: 20px;
      max-width: 700px;
    }

    .powered-by {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0px;
    }

    .powered-label {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }

    .powered-logos {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 30px;
      margin-top: 8px;
    }

    .partner-logo {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .partner-logo svg {
      height: 40px;
      width: auto;
    }

    .partner-logo.scoredetect svg {
      fill: #6b5b95;
    }

    .partner-logo.polygon svg {
      fill: #8247e5;
    }

    .partner-logo.gauntlet svg {
      fill: #c9a962;
      height: 32px;
    }

    .qr-section {
      text-align: center;
    }

    .qr-section img {
      width: 70px;
      height: 70px;
    }

    .qr-code-label {
      font-size: 18px;
      color: #333;
      font-weight: 700;
      margin-top: 8px;
    }

    @media (max-width: 700px) {
      .certificate {
        padding: 20px;
      }
      .content {
        flex-direction: column;
        gap: 25px;
      }
      .artwork {
        flex: none;
        width: 100%;
      }
      .header h1 {
        font-size: 20px;
        letter-spacing: 4px;
      }
      .footer-content {
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }
      .footer-left {
        width: 100%;
        text-align: center;
      }
      .provenance {
        text-align: center;
      }
      .powered-by {
        align-items: center;
        width: 100%;
      }
      .powered-logos {
        justify-content: center;
        gap: 25px;
      }
      .qr-section {
        align-self: center;
      }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <h1>Certificate of Authenticity</h1>
    </div>

    <div class="content">
      <div class="artwork">
        ${d.image ? `<img src="${esc(d.image)}" alt="${esc(d.title)}" onerror="this.style.display='none'" />` : '<div style="width:100%;height:300px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;">No image</div>'}
      </div>

      <div class="details-area">
        <div class="detail-row">
          <span class="detail-label">Artist:</span>
          <span class="detail-value">${esc(d.artist)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Title:</span>
          <span class="detail-value">${esc(d.title)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Year:</span>
          <span class="detail-value">${esc(String(d.year))}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Dimensions:</span>
          <span class="detail-value">${esc(d.dims)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Edition:</span>
          <span class="detail-value">${esc(d.edition)}</span>
        </div>

        <div class="section-spacer"></div>

        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${esc(d.transactionDate)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Assignor:</span>
          <span class="detail-value">Gauntlet Gallery</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Assignee:</span>
          <span class="detail-value">${esc(d.assignee)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Blockchain:</span>
          <span class="detail-value">${esc(d.blockchainUrl)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">NFT:</span>
          <span class="detail-value">${esc(d.nftUrl)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-content">
        <div class="footer-left">
          <p class="provenance">
            Backed by <strong>ScoreDetect</strong> blockchain verification and a unique NFT on the <strong>Polygon</strong> network — the first of its kind ensuring artwork authenticity.
          </p>

          <div class="powered-by">
            <span class="powered-label">Powered by:</span>
            <div class="powered-logos">
              <span class="partner-logo scoredetect">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4" stroke="#fff" stroke-width="2" fill="none"/></svg>
              </span>
              <span class="partner-logo polygon">
                <svg viewBox="0 0 38 33"><path d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.5 3.3c-.7.4-1.6.4-2.4 0l-4.3-2.6c-.7-.4-1.2-1.2-1.2-2.1v-5c0-.8.4-1.6 1.2-2.1l4.3-2.5c.7-.4 1.6-.4 2.4 0l4.3 2.6c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V7c0-.8-.4-1.6-1.2-2.1l-8-4.7c-.7-.4-1.6-.4-2.4 0L1.2 5C.4 5.4 0 6.2 0 7v9.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.5-3.2 3.8-2.2 5.5-3.2c.7-.4 1.6-.4 2.4 0l4.3 2.5c.7.4 1.2 1.2 1.2 2.1v5c0 .8-.4 1.6-1.2 2.1L29 29.7c-.7.4-1.6.4-2.4 0l-4.3-2.6c-.7-.4-1.2-1.2-1.2-2.1v-3.2l-3.8 2.2v3.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1V18c0-.8-.4-1.6-1.2-2.1L29 10.2z"/></svg>
              </span>
              <span class="partner-logo gauntlet">
                <svg viewBox="0 0 100 100"><ellipse cx="50" cy="45" rx="25" ry="20"/><ellipse cx="35" cy="40" rx="20" ry="12" transform="rotate(-30 35 40)"/><ellipse cx="65" cy="40" rx="20" ry="12" transform="rotate(30 65 40)"/><line x1="50" y1="65" x2="50" y2="85" stroke="#c9a962" stroke-width="6"/><line x1="40" y1="75" x2="60" y2="75" stroke="#c9a962" stroke-width="6"/></svg>
              </span>
            </div>
          </div>
        </div>

        <div class="qr-section">
          <img src="${d.qr}" alt="QR Code" />
          <div class="qr-code-label">#${esc(d.code)}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Generate Mobile-optimized HTML (smaller, phone-friendly)
 */
function generateMobileHTML(d) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>COA - ${esc(d.code)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Source+Sans+Pro:wght@400;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Source Sans Pro', sans-serif;
      background: #f5f5f5;
      padding: 15px;
      min-height: 100vh;
    }
    .certificate {
      background: #fff;
      max-width: 400px;
      margin: 0 auto;
      border: 3px solid #6b5b95;
      padding: 20px;
      border-radius: 8px;
    }
    .header h1 {
      font-family: 'Cinzel', serif;
      font-size: 18px;
      color: #c9a962;
      letter-spacing: 4px;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 15px;
    }
    .artwork img {
      width: 100%;
      height: auto;
      display: block;
      margin-bottom: 15px;
      border-radius: 4px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    .detail-label { font-weight: 600; color: #c9a962; }
    .detail-value { color: #333; text-align: right; }
    .section-spacer { height: 15px; }
    .footer {
      border-top: 1px solid #ddd;
      padding-top: 15px;
      margin-top: 15px;
      text-align: center;
    }
    .provenance {
      font-style: italic;
      font-size: 11px;
      color: #666;
      margin-bottom: 12px;
    }
    .powered-logos {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
      margin-bottom: 15px;
    }
    .partner-logo { cursor: pointer; transition: transform 0.2s; }
    .partner-logo:hover { transform: scale(1.1); }
    .partner-logo svg { height: 28px; width: auto; }
    .partner-logo.scoredetect svg { fill: #6b5b95; }
    .partner-logo.polygon svg { fill: #8247e5; }
    .partner-logo.gauntlet svg { fill: #c9a962; }
    .qr-section img { width: 80px; height: 80px; }
    .qr-code-label { font-size: 14px; font-weight: 700; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <h1>Certificate of Authenticity</h1>
    </div>
    ${d.image ? `<div class="artwork"><img src="${esc(d.image)}" alt="${esc(d.title)}" /></div>` : ''}
    <div class="details">
      <div class="detail-row"><span class="detail-label">Artist:</span><span class="detail-value">${esc(d.artist)}</span></div>
      <div class="detail-row"><span class="detail-label">Title:</span><span class="detail-value">${esc(d.title)}</span></div>
      <div class="detail-row"><span class="detail-label">Year:</span><span class="detail-value">${esc(String(d.year))}</span></div>
      <div class="detail-row"><span class="detail-label">Dimensions:</span><span class="detail-value">${esc(d.dims)}</span></div>
      <div class="detail-row"><span class="detail-label">Edition:</span><span class="detail-value">${esc(d.edition)}</span></div>
      <div class="section-spacer"></div>
      <div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">${esc(d.transactionDate)}</span></div>
      <div class="detail-row"><span class="detail-label">Assignor:</span><span class="detail-value">Gauntlet Gallery</span></div>
      <div class="detail-row"><span class="detail-label">Assignee:</span><span class="detail-value">${esc(d.assignee)}</span></div>
      <div class="detail-row"><span class="detail-label">Blockchain:</span><span class="detail-value" style="font-size:11px;">${esc(d.blockchainUrl)}</span></div>
      <div class="detail-row"><span class="detail-label">NFT:</span><span class="detail-value" style="font-size:11px;">${esc(d.nftUrl)}</span></div>
    </div>
    <div class="footer">
      <p class="provenance">Backed by <strong>ScoreDetect</strong> blockchain verification and a unique NFT on the <strong>Polygon</strong> network — the first of its kind ensuring artwork authenticity.</p>
      <div class="powered-logos">
        <span class="partner-logo scoredetect" title="ScoreDetect - Digital authenticity verification">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4" stroke="#fff" stroke-width="2" fill="none"/></svg>
        </span>
        <span class="partner-logo polygon" title="Polygon - Blockchain network">
          <svg viewBox="0 0 38 33"><path d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.5 3.3c-.7.4-1.6.4-2.4 0l-4.3-2.6c-.7-.4-1.2-1.2-1.2-2.1v-5c0-.8.4-1.6 1.2-2.1l4.3-2.5c.7-.4 1.6-.4 2.4 0l4.3 2.6c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V7c0-.8-.4-1.6-1.2-2.1l-8-4.7c-.7-.4-1.6-.4-2.4 0L1.2 5C.4 5.4 0 6.2 0 7v9.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.5-3.2 3.8-2.2 5.5-3.2c.7-.4 1.6-.4 2.4 0l4.3 2.5c.7.4 1.2 1.2 1.2 2.1v5c0 .8-.4 1.6-1.2 2.1L29 29.7c-.7.4-1.6.4-2.4 0l-4.3-2.6c-.7-.4-1.2-1.2-1.2-2.1v-3.2l-3.8 2.2v3.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1V18c0-.8-.4-1.6-1.2-2.1L29 10.2z"/></svg>
        </span>
        <span class="partner-logo gauntlet" title="Gauntlet Gallery - Trusted since 2012">
          <svg viewBox="0 0 100 100"><ellipse cx="50" cy="45" rx="25" ry="20"/><ellipse cx="35" cy="40" rx="20" ry="12" transform="rotate(-30 35 40)"/><ellipse cx="65" cy="40" rx="20" ry="12" transform="rotate(30 65 40)"/><line x1="50" y1="65" x2="50" y2="85" stroke="currentColor" stroke-width="6"/><line x1="40" y1="75" x2="60" y2="75" stroke="currentColor" stroke-width="6"/></svg>
        </span>
      </div>
      <div class="qr-section">
        <img src="${d.qr}" alt="QR Code" title="Scan to verify authenticity" />
        <div class="qr-code-label">#${esc(d.code)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate PDF-optimized HTML (larger, print-ready)
 */
function generatePDFHTML(d) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Certificate of Authenticity - ${esc(d.code)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Source+Sans+Pro:wght@400;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 0.5in; }
    body {
      font-family: 'Source Sans Pro', sans-serif;
      background: #fff;
      padding: 40px;
    }
    .certificate {
      max-width: 800px;
      margin: 0 auto;
      border: 4px solid #6b5b95;
      padding: 50px;
    }
    .header h1 {
      font-family: 'Cinzel', serif;
      font-size: 38px;
      color: #c9a962;
      letter-spacing: 10px;
      text-transform: uppercase;
      text-align: center;
      margin-bottom: 40px;
    }
    .content {
      display: flex;
      gap: 50px;
      margin-bottom: 40px;
    }
    .artwork { flex: 0 0 380px; }
    .artwork img { width: 100%; height: auto; display: block; border: 1px solid #ddd; }
    .details-area { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eee;
      font-size: 16px;
    }
    .detail-label { font-weight: 600; color: #c9a962; }
    .detail-value { color: #333; text-align: right; }
    .section-spacer { height: 30px; }
    .footer {
      border-top: 2px solid #6b5b95;
      padding-top: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-left { flex: 1; }
    .provenance {
      font-style: italic;
      font-size: 14px;
      color: #555;
      margin-bottom: 20px;
      max-width: 500px;
    }
    .powered-logos {
      display: flex;
      align-items: center;
      gap: 35px;
    }
    .partner-logo { cursor: pointer; transition: transform 0.2s, opacity 0.2s; }
    .partner-logo:hover { transform: scale(1.1); opacity: 0.8; }
    .partner-logo svg { height: 45px; width: auto; }
    .partner-logo.scoredetect svg { fill: #6b5b95; }
    .partner-logo.polygon svg { fill: #8247e5; }
    .partner-logo.gauntlet svg { fill: #c9a962; height: 38px; }
    .qr-section { text-align: center; }
    .qr-section img { width: 100px; height: 100px; cursor: pointer; transition: transform 0.2s; }
    .qr-section:hover img { transform: scale(1.15); }
    .qr-code-label { font-size: 20px; font-weight: 700; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <h1>Certificate of Authenticity</h1>
    </div>
    <div class="content">
      <div class="artwork">
        ${d.image ? `<img src="${esc(d.image)}" alt="${esc(d.title)}" />` : '<div style="width:100%;height:400px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#999;font-size:18px;">Artwork Image</div>'}
      </div>
      <div class="details-area">
        <div class="detail-row"><span class="detail-label">Artist:</span><span class="detail-value">${esc(d.artist)}</span></div>
        <div class="detail-row"><span class="detail-label">Title:</span><span class="detail-value">${esc(d.title)}</span></div>
        <div class="detail-row"><span class="detail-label">Year:</span><span class="detail-value">${esc(String(d.year))}</span></div>
        <div class="detail-row"><span class="detail-label">Dimensions:</span><span class="detail-value">${esc(d.dims)}</span></div>
        <div class="detail-row"><span class="detail-label">Edition:</span><span class="detail-value">${esc(d.edition)}</span></div>
        <div class="section-spacer"></div>
        <div class="detail-row"><span class="detail-label">Date:</span><span class="detail-value">${esc(d.transactionDate)}</span></div>
        <div class="detail-row"><span class="detail-label">Assignor:</span><span class="detail-value">Gauntlet Gallery</span></div>
        <div class="detail-row"><span class="detail-label">Assignee:</span><span class="detail-value">${esc(d.assignee)}</span></div>
        <div class="detail-row"><span class="detail-label">Blockchain:</span><span class="detail-value">${esc(d.blockchainUrl)}</span></div>
        <div class="detail-row"><span class="detail-label">NFT:</span><span class="detail-value">${esc(d.nftUrl)}</span></div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-left">
        <p class="provenance">Backed by <strong>ScoreDetect</strong> blockchain verification and a unique NFT on the <strong>Polygon</strong> network — the first of its kind ensuring artwork authenticity.</p>
        <div class="powered-logos">
          <span class="partner-logo scoredetect" title="ScoreDetect - Digital authenticity verification">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4" stroke="#fff" stroke-width="2" fill="none"/></svg>
          </span>
          <span class="partner-logo polygon" title="Polygon - Blockchain network">
            <svg viewBox="0 0 38 33"><path d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.5 3.3c-.7.4-1.6.4-2.4 0l-4.3-2.6c-.7-.4-1.2-1.2-1.2-2.1v-5c0-.8.4-1.6 1.2-2.1l4.3-2.5c.7-.4 1.6-.4 2.4 0l4.3 2.6c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V7c0-.8-.4-1.6-1.2-2.1l-8-4.7c-.7-.4-1.6-.4-2.4 0L1.2 5C.4 5.4 0 6.2 0 7v9.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.5-3.2 3.8-2.2 5.5-3.2c.7-.4 1.6-.4 2.4 0l4.3 2.5c.7.4 1.2 1.2 1.2 2.1v5c0 .8-.4 1.6-1.2 2.1L29 29.7c-.7.4-1.6.4-2.4 0l-4.3-2.6c-.7-.4-1.2-1.2-1.2-2.1v-3.2l-3.8 2.2v3.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1V18c0-.8-.4-1.6-1.2-2.1L29 10.2z"/></svg>
          </span>
          <span class="partner-logo gauntlet" title="Gauntlet Gallery - Trusted since 2012">
            <svg viewBox="0 0 100 100"><ellipse cx="50" cy="45" rx="25" ry="20"/><ellipse cx="35" cy="40" rx="20" ry="12" transform="rotate(-30 35 40)"/><ellipse cx="65" cy="40" rx="20" ry="12" transform="rotate(30 65 40)"/><line x1="50" y1="65" x2="50" y2="85" stroke="currentColor" stroke-width="6"/><line x1="40" y1="75" x2="60" y2="75" stroke="currentColor" stroke-width="6"/></svg>
          </span>
        </div>
      </div>
      <div class="qr-section" title="Scan to verify authenticity">
        <img src="${d.qr}" alt="QR Code" />
        <div class="qr-code-label">#${esc(d.code)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
