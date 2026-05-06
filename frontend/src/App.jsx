import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DEFAULT_CONTRACT_URL = 'https://polygonscan.com/address/0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1'
const DEFAULT_CREATE_FORM = {
  coaCode: '',
  signer: '',
  title: '',
  date: '',
  medium: '',
  dimensions: '',
  edition: '',
  condition: '',
  description: '',
  provenance: '',
  imageUrl: '',
  sku: '',
  assignee: '',
  recipient: '',
  createScoreDetect: false,
  mintPolygon: false
}
function formatDisplayDate(value) {
  if (!value) return ''

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return value
}

function buildQrValue(result) {
  return result.coa.shortUrl || result.external_url || `${window.location.origin}/AUTHENTICATE/${result.coa.code}`
}

function buildBlockchainLink(result) {
  if (result.coa.blockchainUrl) return result.coa.blockchainUrl
  if (result.blockchain?.verified && result.blockchain.tokenId) {
    return `https://polygonscan.com/token/${result.blockchain.contractAddress}?a=${result.blockchain.tokenId}`
  }
  return ''
}

function buildNftLink(result) {
  if (result.coa.nftUrl) return result.coa.nftUrl
  if (result.blockchain?.verified && result.blockchain.tokenId) {
    return `https://opensea.io/assets/matic/${result.blockchain.contractAddress}/${result.blockchain.tokenId}`
  }
  return ''
}

function buildCertificateImageUrl(result) {
  if (!result?.coa?.imageUrl) return ''
  if (result.coa.imageProxy === false) return result.coa.imageUrl
  return `${API_URL}/api/image/${result.coa.code}`
}

function buildCreateButtonLabel(form, creating) {
  if (creating) return 'Creating...'
  if (form.createScoreDetect && form.mintPolygon) return 'Create + ScoreDetect + Polygon NFT'
  if (form.createScoreDetect) return 'Create + ScoreDetect'
  if (form.mintPolygon) return 'Create + Mint Polygon NFT'
  return 'Create COA Record'
}

function buildCreatedVerificationResult(createResult) {
  const coa = createResult?.coa
  if (!coa?.coaCode) return null

  const code = coa.coaCode
  const imageUrl = coa.imageUrl || ''
  const polygon = createResult.polygon
  const scoreDetect = createResult.scoreDetect
  const verificationUrl = `${window.location.origin}/AUTHENTICATE/${code}`

  return {
    success: true,
    name: `TrueCOA - ${coa.title || 'Untitled'}`,
    image: imageUrl,
    external_url: verificationUrl,
    coa: {
      code,
      artist: coa.signer || coa.artist || '',
      title: coa.title || 'Untitled',
      date: coa.date || '',
      completionDate: coa.completionDate || new Date().toISOString().slice(0, 10),
      size: coa.dimensions || coa.size || '',
      edition: coa.edition || '',
      medium: coa.medium || '',
      condition: coa.condition || '',
      description: coa.description || '',
      provenance: coa.provenance || '',
      assignor: coa.assignor || '',
      assignee: coa.assignee || '',
      authNotes: coa.authNotes || '',
      authenticator: coa.authenticator || '',
      authenticatorNumber: coa.authenticatorNumber || '',
      authenticatorDate: coa.authenticatorDate || '',
      authenticatorLink: coa.authenticatorLink || '',
      qrCodeUrl: coa.qrCode || '',
      shortUrl: verificationUrl,
      blockchainUrl: coa.blockchainUrl || polygon?.blockchainUrl || '',
      nftUrl: coa.nftUrl || polygon?.nftUrl || '',
      certUrl: coa.certUrl || scoreDetect?.verificationUrl || '',
      sku: coa.sku || '',
      imageUrl,
      imageProxy: imageUrl.includes('drive.google.com') && !createResult.warning
    },
    blockchain: polygon?.tokenId ? {
      verified: true,
      tokenId: polygon.tokenId,
      owner: polygon.owner,
      contractAddress: polygon.contractAddress,
      network: 'Polygon'
    } : {
      verified: false,
      reason: 'NFT not minted on Polygon'
    },
    scoreDetect,
    verifiedAt: new Date().toISOString()
  }
}

function displayLinkText(url, fallback) {
  if (!url) return fallback
  return url.replace(/^https?:\/\//, '')
}

function App() {
  const [mode, setMode] = useState('verify')
  const [coaCode, setCoaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showCert, setShowCert] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM)
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState(null)
  const [createError, setCreateError] = useState(null)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

  // Reinitialize ScoreDetect widget when result is shown
  useEffect(() => {
    if (result && window.SDWidgets) {
      window.SDWidgets.init()
    }
  }, [result])

  // Check URL for code parameter (supports ?code=X and /AUTHENTICATE/X and /verify/X)
  useEffect(() => {
    // Check query parameter first
    const params = new URLSearchParams(window.location.search)
    const codeParam = params.get('code')
    if (codeParam) {
      setCoaCode(codeParam)
      handleVerify(codeParam)
      return
    }

    // Check path-based routes: /AUTHENTICATE/290745 or /verify/290745
    const path = window.location.pathname
    const authenticateMatch = path.match(/\/(?:AUTHENTICATE|authenticate|verify)\/([A-Za-z0-9-]+)/i)
    if (authenticateMatch) {
      const code = authenticateMatch[1]
      setCoaCode(code)
      handleVerify(code)
    }
  }, [])

  const handleVerify = async (code = coaCode) => {
    if (!code.trim()) {
      setError('Please enter a COA code')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_URL}/api/verify/${encodeURIComponent(code.trim())}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      setResult(data)
    } catch (err) {
      setError(err.message || 'Failed to verify COA')
    } finally {
      setLoading(false)
    }
  }

  const startScanner = async () => {
    setShowScanner(true)

    // Dynamically import html5-qrcode
    const { Html5Qrcode } = await import('html5-qrcode')

    setTimeout(async () => {
      if (scannerRef.current && !html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader')
        try {
          await html5QrCodeRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              // Extract code from various formats
              let code = decodedText

              // Handle "AUTHENTICATE/290745" format from stickers
              const authMatch = decodedText.match(/AUTHENTICATE\/([A-Za-z0-9-]+)/i)
              if (authMatch) {
                code = authMatch[1]
              } else {
                // Try URL format
                try {
                  const url = new URL(decodedText)
                  code = url.searchParams.get('code') || url.pathname.match(/\/([A-Za-z0-9-]+)$/)?.[1] || decodedText
                } catch {}
              }

              setCoaCode(code)
              stopScanner()
              handleVerify(code)
            },
            () => {}
          )
        } catch (err) {
          setError('Failed to start camera. Please enter code manually.')
          setShowScanner(false)
        }
      }
    }, 100)
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current = null
      } catch {}
    }
    setShowScanner(false)
  }

  const resetForm = () => {
    setResult(null)
    setError(null)
    setShowCert(false)
    setCoaCode('')
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError(null)
    setCreateError(null)
    setShowCert(false)
  }

  const handleCreateChange = (event) => {
    const { name, value, type, checked } = event.target
    setCreateForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleCreateSubmit = async (event) => {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateResult(null)

    const payload = {
      ...createForm,
      recipient: createForm.recipient.trim() || undefined
    }

    try {
      const response = await fetch(`${API_URL}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()

      if (!response.ok && response.status !== 207) {
        throw new Error(data.message || data.error || 'Failed to create COA')
      }

      setCreateResult(data)
      setCreateForm(DEFAULT_CREATE_FORM)
    } catch (err) {
      setCreateError(err.message || 'Failed to create COA')
    } finally {
      setCreating(false)
    }
  }

  const verifyCreatedCOA = () => {
    const code = createResult?.coa?.coaCode
    if (!code) return
    switchMode('verify')
    setCoaCode(code)
    handleVerify(code)
  }

  const viewCreatedCOA = () => {
    const createdResult = buildCreatedVerificationResult(createResult)
    if (!createdResult) return
    setMode('verify')
    setError(null)
    setCreateError(null)
    setCoaCode(createdResult.coa.code)
    setResult(createdResult)
    setShowCert(true)
  }

  const verificationUrl = result ? buildQrValue(result) : ''
  const blockchainUrl = result ? buildBlockchainLink(result) : ''
  const footerBlockchainUrl = blockchainUrl || DEFAULT_CONTRACT_URL
  const nftUrl = result ? buildNftLink(result) : ''
  const certificateUrl = result?.coa.certUrl || ''
  const certificateImageUrl = buildCertificateImageUrl(result)
  const hasPolygonRecord = Boolean(result?.blockchain?.verified || result?.coa.blockchainUrl)
  const hasThirdPartyAuthentication = Boolean(
    result?.coa.authenticator ||
    result?.coa.authenticatorNumber ||
    result?.coa.authenticatorDate ||
    result?.coa.authenticatorLink ||
    result?.coa.authNotes
  )

  return (
    <div className="app">
      <header>
        <div className="logo">
          <img src="/logo-white.png" alt="TrueCOA" className="logo-image" />
        </div>
        <nav className="top-nav" aria-label="TrueCOA tools">
          <button className={mode === 'verify' ? 'active' : ''} onClick={() => switchMode('verify')}>Verify</button>
          <button className={mode === 'create' ? 'active' : ''} onClick={() => switchMode('create')}>Create COA</button>
        </nav>
      </header>

      <main>
        {mode === 'create' ? (
          <div className="create-section">
            <h1>Create COA</h1>
            <p className="subtitle">Create a certificate record, append it to the COA sheet, and optionally create a ScoreDetect record and Polygon NFT.</p>

            <form className="create-form" onSubmit={handleCreateSubmit}>
              <div className="form-grid">
                <label>
                  COA Code
                  <input name="coaCode" value={createForm.coaCode} onChange={handleCreateChange} placeholder="Auto-generated if blank" />
                </label>
                <label>
                  Artist / Signer *
                  <input name="signer" value={createForm.signer} onChange={handleCreateChange} required />
                </label>
                <label className="full-width">
                  Title *
                  <input name="title" value={createForm.title} onChange={handleCreateChange} required />
                </label>
                <label>
                  Date
                  <input name="date" value={createForm.date} onChange={handleCreateChange} placeholder="2026" />
                </label>
                <label>
                  Medium
                  <input name="medium" value={createForm.medium} onChange={handleCreateChange} placeholder="Screenprint on paper" />
                </label>
                <label>
                  Dimensions
                  <input name="dimensions" value={createForm.dimensions} onChange={handleCreateChange} placeholder='24" x 18"' />
                </label>
                <label>
                  Edition
                  <input name="edition" value={createForm.edition} onChange={handleCreateChange} placeholder="12 of 300" />
                </label>
                <label>
                  Condition
                  <input name="condition" value={createForm.condition} onChange={handleCreateChange} />
                </label>
                <label>
                  SKU
                  <input name="sku" value={createForm.sku} onChange={handleCreateChange} />
                </label>
                <label className="full-width">
                  Image URL
                  <input name="imageUrl" type="url" value={createForm.imageUrl} onChange={handleCreateChange} placeholder="https://..." />
                </label>
                <label className="full-width">
                  Description
                  <textarea name="description" value={createForm.description} onChange={handleCreateChange} rows="3" />
                </label>
                <label className="full-width">
                  Provenance
                  <textarea name="provenance" value={createForm.provenance} onChange={handleCreateChange} rows="3" />
                </label>
                <label className="full-width">
                  Assignee
                  <input name="assignee" value={createForm.assignee} onChange={handleCreateChange} placeholder="Collector or buyer name" />
                </label>
                <label className="checkbox-row full-width">
                  <input name="createScoreDetect" type="checkbox" checked={createForm.createScoreDetect} onChange={handleCreateChange} />
                  Create ScoreDetect blockchain record
                </label>
                <label className="checkbox-row full-width">
                  <input name="mintPolygon" type="checkbox" checked={createForm.mintPolygon} onChange={handleCreateChange} />
                  Mint Polygon NFT now
                </label>
                {createForm.mintPolygon && (
                  <label className="full-width">
                    Recipient Wallet
                    <input name="recipient" value={createForm.recipient} onChange={handleCreateChange} placeholder="Defaults to backend signer wallet" />
                  </label>
                )}
              </div>

              <button className="verify-btn create-submit" type="submit" disabled={creating}>
                {buildCreateButtonLabel(createForm, creating)}
              </button>
            </form>

            {createError && <div className="error-message">{createError}</div>}

            {createResult && (
              <div className="create-result">
                <div>
                  <span className="result-label">COA Created</span>
                  <strong>{createResult.coa.coaCode}</strong>
                </div>
                {createResult.warning && (
                  <p className="warning-message">
                    {createResult.warning}{createResult.sheetError ? `: ${createResult.sheetError}` : ''}
                  </p>
                )}
                {createResult.operationErrors?.length > 0 && (
                  <ul className="warning-list">
                    {createResult.operationErrors.map((operationError) => (
                      <li key={`${operationError.service}-${operationError.message}`}>
                        {operationError.service}: {operationError.message}
                      </li>
                    ))}
                  </ul>
                )}
                {createResult.scoreDetect && (
                  <div className="result-links">
                    {createResult.scoreDetect.verificationUrl && <a href={createResult.scoreDetect.verificationUrl} target="_blank" rel="noopener noreferrer">ScoreDetect record</a>}
                    {createResult.scoreDetect.transactionUrl && <a href={createResult.scoreDetect.transactionUrl} target="_blank" rel="noopener noreferrer">ScoreDetect transaction</a>}
                  </div>
                )}
                {createResult.polygon && (
                  <div className="result-links">
                    {createResult.polygon.nftUrl && <a href={createResult.polygon.nftUrl} target="_blank" rel="noopener noreferrer">Open NFT COA Image</a>}
                    {createResult.polygon.blockchainUrl && <a href={createResult.polygon.blockchainUrl} target="_blank" rel="noopener noreferrer">Polygon token</a>}
                    {createResult.polygon.transactionUrl && <a href={createResult.polygon.transactionUrl} target="_blank" rel="noopener noreferrer">Polygon transaction</a>}
                  </div>
                )}
                <div className="create-actions">
                  <button className="verify-btn" onClick={viewCreatedCOA}>View COA</button>
                  <button className="scan-btn" onClick={verifyCreatedCOA}>Verify This COA</button>
                </div>
              </div>
            )}
          </div>
        ) : !result ? (
          <div className="verify-section">
            <h1>Certificate of Authenticity</h1>
            <br />
            <p className="subtitle">Provenance matters. This certificate is cryptographically secured on the Polygon blockchain and linked to a unique NFT, creating an unalterable chain of custody. Transparent Authenticity.</p>

            <div className="input-group">
              <input
                type="text"
                placeholder="Enter COA Code (e.g., 290745)"
                value={coaCode}
                onChange={(e) => setCoaCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                disabled={loading}
              />
              <button
                className="verify-btn"
                onClick={() => handleVerify()}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            {!showScanner ? (
              <button className="scan-btn" onClick={startScanner}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M4 4h4V2H2v6h2V4zm0 12H2v6h6v-2H4v-4zm16 4h-4v2h6v-6h-2v4zM16 2v2h4v4h2V2h-6z"/>
                  <path d="M5 5h6v6H5zm1 1v4h4V6H6zm7-1h6v6h-6zm1 1v4h4V6h-4zM5 13h6v6H5zm1 1v4h4v-4H6zm8 0h1v1h-1zm2 0h1v1h-1zm2 0h1v1h-1zm-4 2h1v1h-1zm4 0h1v1h-1zm-2 2h1v1h-1zm2 0h1v1h-1z"/>
                </svg>
                Scan QR Code
              </button>
            ) : (
              <div className="scanner-container">
                <div id="qr-reader" ref={scannerRef}></div>
                <button className="cancel-btn" onClick={stopScanner}>Cancel</button>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}
          </div>
        ) : result && !showCert ? (
          <div className="verified-landing">
            <div className="verified-badge">&#10003;</div>
            <h1>Certificate Verified</h1>
            <p className="verified-intro">
              <strong>"{result.coa.title}"</strong> by <strong>{result.coa.artist}</strong> has been authenticated and cryptographically secured on the Polygon blockchain.
            </p>
            <div className="verified-actions">
              <button className="action-btn action-btn--primary" onClick={() => setShowCert(true)}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                View Visual NFT Online
              </button>
              <button className="action-btn action-btn--secondary" onClick={() => { setShowCert(true); setTimeout(() => window.print(), 500) }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Download PDF of COA
              </button>
            </div>
            <button className="back-link" onClick={resetForm}>Verify a different certificate</button>
          </div>
        ) : (
          <div className="result-section">
            <div
              className="coa-certificate"
              style={certificateImageUrl ? { '--coa-bg-image': `url("${certificateImageUrl}")` } : undefined}
            >

              {/* ===== TITLE BAR (above metallic strip) ===== */}
              <div className="cert-title-bar">
                <h2>Certificate of Authenticity</h2>
                <div className="cert-qr">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verificationUrl)}`}
                    alt="QR Code"
                  />
                  <span>#{result.coa.code}</span>
                </div>
              </div>

              {/* ===== METALLIC STRIP GAP ===== */}
              <div className="cert-strip-gap"></div>

              {/* ===== MAIN CERTIFICATE (below metallic strip) ===== */}
              <div className="cert-main">
                {/* Two-column body: image left, content right */}
                <div className="cert-body">
                  <div className="cert-left">
                    {result.coa.imageUrl && (
                      <img
                        src={certificateImageUrl}
                        alt={result.coa.title}
                        className="cert-artwork"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    {!result.coa.imageUrl && (
                      <div className="cert-artwork-placeholder">
                        <span>Artwork image unavailable</span>
                      </div>
                    )}
                  </div>

                  <div className="cert-right">
                    <div className="cert-section">
                      <div className="cert-detail"><span>Artist:</span><span>{result.coa.artist}</span></div>
                      <div className="cert-detail"><span>Title:</span><span>{result.coa.title}</span></div>
                      {result.coa.date && <div className="cert-detail"><span>Date:</span><span>{result.coa.date}</span></div>}
                      {result.coa.medium && <div className="cert-detail"><span>Medium:</span><span>{result.coa.medium}</span></div>}
                      {result.coa.size && <div className="cert-detail"><span>Dimensions:</span><span>{result.coa.size}</span></div>}
                      {result.coa.edition && <div className="cert-detail"><span>Edition:</span><span>{result.coa.edition}</span></div>}
                    </div>

                    {result.coa.description && (
                      <div className="cert-section">
                        <h3>Description</h3>
                        <p className="cert-text">{result.coa.description}</p>
                      </div>
                    )}

                    {result.coa.provenance && (
                      <div className="cert-section">
                        <h3>Provenance</h3>
                        <p className="cert-text">{result.coa.provenance}</p>
                      </div>
                    )}

                    <div className="cert-section">
                      <h3>Digital Authentication</h3>
                      {result.coa.completionDate && (
                        <div className="cert-detail">
                          <span>Date:</span>
                          <span>{formatDisplayDate(result.coa.completionDate)}</span>
                        </div>
                      )}
                      <div className="cert-detail">
                        <span>Blockchain:</span>
                        <span>
                          {blockchainUrl ? (
                            <a href={blockchainUrl} target="_blank" rel="noopener noreferrer">
                              {result.blockchain?.tokenId ? `Polygon token #${result.blockchain.tokenId}` : displayLinkText(blockchainUrl, 'Polygon')}
                            </a>
                          ) : (
                            'Not minted on Polygon'
                          )}
                        </span>
                      </div>
                      {certificateUrl && (
                        <div className="cert-detail">
                          <span>Certificate:</span>
                          <span>
                            <a href={certificateUrl} target="_blank" rel="noopener noreferrer">
                              {certificateUrl.match(/([a-f0-9-]{8,})/)?.[1] || 'ScoreDetect'}
                            </a>
                          </span>
                        </div>
                      )}
                    </div>

                    {hasThirdPartyAuthentication && (
                      <div className="cert-section">
                        <h3>Third Party Authentication</h3>
                        {result.coa.authenticator && <div className="cert-detail"><span>Name:</span><span>{result.coa.authenticator}</span></div>}
                        {result.coa.authenticatorNumber && <div className="cert-detail"><span>Number:</span><span>{result.coa.authenticatorNumber}</span></div>}
                        {result.coa.authenticatorDate && <div className="cert-detail"><span>Date:</span><span>{formatDisplayDate(result.coa.authenticatorDate)}</span></div>}
                        {result.coa.authenticatorLink && (
                          <div className="cert-detail cert-detail--multiline">
                            <span>Link:</span>
                            <span>
                              <a href={result.coa.authenticatorLink} target="_blank" rel="noopener noreferrer">
                                {displayLinkText(result.coa.authenticatorLink, 'View certificate')}
                              </a>
                            </span>
                          </div>
                        )}
                        {result.coa.authNotes && (
                          <div className="cert-auth-note">{result.coa.authNotes}</div>
                        )}
                      </div>
                    )}

                    {result.blockchain?.verified && (
                      <div className="cert-section">
                        <h3>NFT Record</h3>
                        <div className="cert-detail"><span>Status:</span><span>Minted on {result.blockchain.network}</span></div>
                        <div className="cert-detail"><span>Token ID:</span><span>{result.blockchain.tokenId}</span></div>
                        {nftUrl && (
                          <div className="cert-detail">
                            <span>NFT:</span>
                            <span>
                              <a href={nftUrl} target="_blank" rel="noopener noreferrer">Open COA image</a>
                            </span>
                          </div>
                        )}
                        <div className="cert-detail cert-detail--multiline"><span>Owner:</span><span>{result.blockchain.owner}</span></div>
                      </div>
                    )}

                    <div className="cert-created">
                      {result.coa.completionDate && <span>Created on {formatDisplayDate(result.coa.completionDate)}</span>}
                      <span className="cert-verify-url">{verificationUrl}</span>
                    </div>
                  </div>
                </div>

                {/* Footer logos */}
                <div className="cert-footer">
                  <div className="cert-footer-logos">
                    <span>Powered by:</span>
                    <a href={certificateUrl || 'https://scoredetect.com'} target="_blank" rel="noopener noreferrer" className="footer-partner">
                      <img src="/logo.png" alt="TrueCOA" /><span>TrueCOA</span>
                    </a>
                    <a href={certificateUrl || 'https://scoredetect.com'} target="_blank" rel="noopener noreferrer" className="footer-partner">
                      <img src="/scoredetect.png" alt="ScoreDetect" /><span>ScoreDetect</span>
                    </a>
                    <a href={footerBlockchainUrl} target="_blank" rel="noopener noreferrer" className="footer-partner">
                      <img src="/polygon.png" alt="Polygon" /><span>Polygon</span>
                    </a>
                  </div>
                  <div className="cert-footer-text">
                    {hasPolygonRecord ? 'Secured by Polygon blockchain.' : 'Polygon NFT not minted yet.'}<br />Transparent Authenticity.
                  </div>
                </div>
              </div>
            </div>

            <button className="back-btn" onClick={resetForm}>
              Verify Another Certificate
            </button>
          </div>
        )}
      </main>

      <section className="about-section">
        <h2>About TrueCOA</h2>
        <p>TrueCOA provides blockchain-verified Certificates of Authenticity for art, collectibles, and unique items. Every certificate is cryptographically secured on the Polygon blockchain and linked to a unique NFT, creating an unalterable chain of custody.</p>
        <p>Transparent Authenticity — that's our promise.</p>
      </section>

      <footer>
        <p>&copy; {new Date().getFullYear()} TrueCOA. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
