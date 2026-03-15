# TrueCOA Certificate Generator

Automated Certificate of Authenticity generation for Google Sheets.

## Features

- **Bit.ly Short Links**: Creates branded short URLs for verification
- **QR Codes**: Auto-generates QR codes for each certificate
- **PDF Certificates**: Creates professional PDF certificates
- **Google Drive Storage**: Saves all certificates to organized folders
- **Batch Processing**: Process all rows or individual certificates

## Setup Instructions

### Step 1: Open Google Sheets Script Editor

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/16Kya2WQD0tbXTdsug9zSuoP03XmWXsZRTIykbEbBJBU
2. Go to **Extensions > Apps Script**

### Step 2: Add the Script

1. Delete any existing code in the editor
2. Copy the entire contents of `COAGenerator.gs`
3. Paste into the script editor
4. Click **Save** (disk icon or Ctrl+S)

### Step 3: Authorize the Script

1. Click **Run > Run function > setupTriggers**
2. Click **Review Permissions**
3. Select your Google account
4. Click **Advanced > Go to TrueCOA (unsafe)**
5. Click **Allow**

### Step 4: Verify Setup

1. Close and reopen the Google Sheet
2. You should see a new menu: **🎨 COA Generator**
3. Click **COA Generator > Setup/Check Folders**
4. Verify all checks pass

## Sheet Structure

Your COA sheet should have these columns:

| Column | Name | Description |
|--------|------|-------------|
| A | COA_Code | Unique certificate code (e.g., "290745") |
| B | QR_Code | (Auto-filled) QR code image URL |
| C | Artist | Artist name |
| D | Title | Artwork title |
| E | Date | Creation date/year |
| F | Length | Height in inches |
| G | Width | Width in inches |
| H | Number | Edition number |
| I | Edition | Total edition size |
| J | Assignee | Owner/collector name |
| K | Image_URL | Direct URL to artwork image |
| L | SKU | Product SKU |
| M | Short_URL | (Auto-filled) Bit.ly short link |
| N | Cert_URL | (Auto-filled) Google Drive certificate link |
| O | Generated | (Auto-filled) Generation timestamp |

## Usage

### Generate All Certificates
- **COA Generator > Generate All Certificates**
- Processes all rows without a "Generated" timestamp
- Creates Bit.ly links, QR codes, and PDF certificates

### Generate Single Certificate
1. Click on any cell in the row you want to process
2. **COA Generator > Generate Selected Row**

### Create Short Links Only
- **COA Generator > Create Short Links Only**
- Creates Bit.ly links without generating full certificates
- Useful for quick updates

### Refresh QR Codes
- **COA Generator > Refresh QR Codes**
- Updates QR codes for all rows
- Uses existing Short_URL if available

## Configuration

Edit these values in the `CONFIG` object at the top of the script:

```javascript
const CONFIG = {
  BITLY_API_KEY: 'your-api-key-here',
  VERCEL_FRONTEND_URL: 'https://gauntlet-coa-frontend.vercel.app',
  DRIVE_FOLDER_NAME: 'TrueCOA Certificates',
  SHEET_NAME: 'COA'
};
```

## Verification URL Formats

The system supports multiple URL formats:
- `https://gauntlet-coa-frontend.vercel.app/AUTHENTICATE/290745`
- `https://gauntlet-coa-frontend.vercel.app/?code=290745`
- Short link: `https://bit.ly/xxx`

## Troubleshooting

### "Sheet not found" error
- Verify the sheet tab is named "COA" (case-sensitive)
- Or update `CONFIG.SHEET_NAME` to match your tab name

### Bit.ly errors
- Run **COA Generator > Test Bit.ly API** to check connection
- Verify API key is correct
- Check Bit.ly account has available links

### Permission errors
- Re-run authorization: Run > setupTriggers
- Make sure you're signed into the correct Google account

## Files Generated

For each certificate, the script creates:
- **QR Code URL**: Stored in column B
- **Short URL**: Bit.ly link in column M
- **PDF Certificate**: Saved to Google Drive, link in column N
- **Timestamp**: Generation time in column O

## Support

For issues or questions, contact TrueCOA support.
