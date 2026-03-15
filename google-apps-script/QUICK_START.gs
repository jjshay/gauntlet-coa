/**
 * TRUECOA - COA GENERATOR (QUICK START VERSION)
 *
 * SETUP:
 * 1. Open Google Sheet: https://docs.google.com/spreadsheets/d/16Kya2WQD0tbXTdsug9zSuoP03XmWXsZRTIykbEbBJBU
 * 2. Go to Extensions > Apps Script
 * 3. Delete existing code, paste this entire file
 * 4. Click Save, then Run > onOpen
 * 5. Authorize when prompted
 * 6. Refresh sheet - menu will appear
 *
 * Your COA tab columns should be:
 * A: COA_Code | B: QR_Code | C: Artist | D: Title | E: Date | F: Length | G: Width
 * H: Number | I: Edition | J: Assignee | K: Image_URL | L: SKU | M: Short_URL | N: Cert_URL | O: Generated
 */

// === CONFIGURATION ===
const BITLY_KEY = '485a216ca4141d6f381d6d16bf1ae5ef33a4e49e';
const VERIFY_URL = 'https://gauntlet-coa-frontend.vercel.app';
const SHEET_NAME = 'COA';
const FOLDER_NAME = 'TrueCOA Certificates';

// Column indices (0-based)
const COL = {
  CODE: 0, QR: 1, ARTIST: 2, TITLE: 3, DATE: 4, LENGTH: 5, WIDTH: 6,
  NUMBER: 7, EDITION: 8, ASSIGNEE: 9, IMAGE: 10, SKU: 11, SHORT: 12, CERT: 13, DONE: 14
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎨 COA Generator')
    .addItem('Generate All', 'generateAll')
    .addItem('Generate Selected Row', 'generateRow')
    .addItem('Create Short Links Only', 'shortLinksOnly')
    .addItem('Test Bit.ly', 'testBitly')
    .addToUi();
}

function generateAll() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const folder = getFolder();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    if (!data[i][COL.CODE] || data[i][COL.DONE]) continue;
    try {
      process(sheet, i + 1, data[i], folder);
      count++;
      Utilities.sleep(500);
    } catch(e) { Logger.log(`Row ${i+1}: ${e.message}`); }
  }
  SpreadsheetApp.getUi().alert(`Generated ${count} certificates`);
}

function generateRow() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = sheet.getActiveRange().getRow();
  if (row <= 1) { SpreadsheetApp.getUi().alert('Select a data row'); return; }
  const data = sheet.getRange(row, 1, 1, 15).getValues()[0];
  process(sheet, row, data, getFolder());
  SpreadsheetApp.getUi().alert('Done!');
}

function process(sheet, row, data, folder) {
  const code = String(data[COL.CODE]).trim();
  if (!code) return;

  const longUrl = `${VERIFY_URL}/AUTHENTICATE/${code}`;
  const short = bitly(longUrl, code) || longUrl;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(short)}`;

  const cert = createPDF({
    code, short, qr,
    artist: data[COL.ARTIST] || 'Unknown',
    title: data[COL.TITLE] || 'Untitled',
    date: data[COL.DATE] || '',
    dims: data[COL.LENGTH] && data[COL.WIDTH] ? `${data[COL.LENGTH]}" × ${data[COL.WIDTH]}"` : '',
    edition: data[COL.NUMBER] && data[COL.EDITION] ? `${data[COL.NUMBER]} of ${data[COL.EDITION]}` : '',
    assignee: data[COL.ASSIGNEE] || '',
    image: data[COL.IMAGE] || ''
  }, folder);

  sheet.getRange(row, COL.QR + 1).setValue(qr);
  sheet.getRange(row, COL.SHORT + 1).setValue(short);
  sheet.getRange(row, COL.CERT + 1).setValue(cert ? cert.getUrl() : '');
  sheet.getRange(row, COL.DONE + 1).setValue(new Date().toISOString());
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
    return res.getResponseCode() < 300 ? json.link : null;
  } catch(e) { return null; }
}

function shortLinksOnly() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (!data[i][COL.CODE] || data[i][COL.SHORT]) continue;
    const short = bitly(`${VERIFY_URL}/AUTHENTICATE/${data[i][COL.CODE]}`, data[i][COL.CODE]);
    if (short) { sheet.getRange(i + 1, COL.SHORT + 1).setValue(short); count++; }
    Utilities.sleep(500);
  }
  SpreadsheetApp.getUi().alert(`Created ${count} short links`);
}

function testBitly() {
  const result = bitly('https://example.com/test', 'TEST');
  SpreadsheetApp.getUi().alert(result ? `✅ Working: ${result}` : '❌ Failed - check API key');
}

function getFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}

function createPDF(d, folder) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Open+Sans:wght@400;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Open Sans',sans-serif;padding:40px;max-width:800px;margin:0 auto}
    .cert{border:3px solid #1a1a2e;padding:40px;position:relative}
    .cert::before{content:'';position:absolute;top:10px;left:10px;right:10px;bottom:10px;border:1px solid #d4af37;pointer-events:none}
    .header{text-align:center;border-bottom:2px solid #1a1a2e;padding-bottom:20px;margin-bottom:30px}
    .logo{font-family:'Playfair Display',serif;font-size:28px;font-weight:600;color:#1a1a2e;letter-spacing:3px}
    .sub{font-size:12px;letter-spacing:4px;color:#666;text-transform:uppercase}
    h1{font-family:'Playfair Display',serif;font-size:32px;color:#1a1a2e;text-align:center;margin:30px 0;letter-spacing:2px}
    .img{text-align:center;margin:30px 0}
    .img img{max-width:400px;max-height:300px;border:1px solid #ddd;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
    .row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}
    .lbl{font-weight:600;color:#666;text-transform:uppercase;font-size:11px;letter-spacing:1px}
    .val{color:#1a1a2e;font-size:14px}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;padding-top:20px;border-top:2px solid #1a1a2e}
    .qr{text-align:center}.qr img{width:100px;height:100px}.qr .code{font-size:12px;color:#666;margin-top:5px;font-family:monospace}
    .badge{display:inline-flex;align-items:center;background:#d4edda;color:#155724;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600}
    .badge svg{width:16px;height:16px;margin-right:6px;fill:currentColor}
    .url{font-size:10px;color:#666;margin-top:8px}
    .sig{border-top:1px solid #1a1a2e;width:200px;margin-top:40px;padding-top:8px;font-size:10px;color:#666;text-align:center}
  </style></head><body>
  <div class="cert">
    <div class="header"><div class="logo">TRUECOA</div><div class="sub">Fine Art & Collectibles</div></div>
    <h1>Certificate of Authenticity</h1>
    ${d.image ? `<div class="img"><img src="${d.image}" alt="${esc(d.title)}"/></div>` : ''}
    <div class="details">
      <div class="row"><span class="lbl">Artist</span><span class="val">${esc(d.artist)}</span></div>
      <div class="row"><span class="lbl">Title</span><span class="val">${esc(d.title)}</span></div>
      ${d.date ? `<div class="row"><span class="lbl">Date</span><span class="val">${esc(String(d.date))}</span></div>` : ''}
      ${d.dims ? `<div class="row"><span class="lbl">Dimensions</span><span class="val">${d.dims}</span></div>` : ''}
      ${d.edition ? `<div class="row"><span class="lbl">Edition</span><span class="val">${d.edition}</span></div>` : ''}
      ${d.assignee ? `<div class="row"><span class="lbl">Assigned To</span><span class="val">${esc(d.assignee)}</span></div>` : ''}
      <div class="row"><span class="lbl">COA Code</span><span class="val" style="font-family:monospace">${esc(d.code)}</span></div>
    </div>
    <div class="footer">
      <div class="qr"><img src="${d.qr}" alt="QR"/><div class="code">${d.code}</div></div>
      <div class="sig">Authorized Signature</div>
      <div><div class="badge"><svg viewBox="0 0 24 24"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/></svg>Blockchain Verified</div><div class="url">${d.short}</div></div>
    </div>
  </div></body></html>`;

  const tmp = folder.createFile(`tmp_${d.code}.html`, html, MimeType.HTML);
  const pdf = folder.createFile(tmp.getAs(MimeType.PDF).setName(`COA_${d.code}_${d.artist.replace(/\s+/g,'_')}.pdf`));
  tmp.setTrashed(true);
  return pdf;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
