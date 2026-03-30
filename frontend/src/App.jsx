import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DEFAULT_CONTRACT_URL = 'https://polygonscan.com/address/0xD55496144F8CD69046656ddd5bb894c8b0C2d1b1'

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
  return DEFAULT_CONTRACT_URL
}

function buildNftLink(result) {
  if (result.coa.nftUrl) return result.coa.nftUrl
  if (result.blockchain?.verified && result.blockchain.tokenId) {
    return `https://opensea.io/assets/matic/${result.blockchain.contractAddress}/${result.blockchain.tokenId}`
  }
  return ''
}

function displayLinkText(url, fallback) {
  if (!url) return fallback
  return url.replace(/^https?:\/\//, '')
}

function App() {
  const [coaCode, setCoaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
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
    const authenticateMatch = path.match(/\/(?:AUTHENTICATE|authenticate|verify)\/([A-Za-z0-9]+)/i)
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
              const authMatch = decodedText.match(/AUTHENTICATE\/(\d+)/i)
              if (authMatch) {
                code = authMatch[1]
              } else {
                // Try URL format
                try {
                  const url = new URL(decodedText)
                  code = url.searchParams.get('code') || url.pathname.match(/\/(\d+)$/)?.[1] || decodedText
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
    setCoaCode('')
  }

  const verificationUrl = result ? buildQrValue(result) : ''
  const blockchainUrl = result ? buildBlockchainLink(result) : DEFAULT_CONTRACT_URL
  const nftUrl = result ? buildNftLink(result) : ''
  const certificateUrl = result?.coa.certUrl || ''
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
      </header>

      <main>
        {!result ? (
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
        ) : (
          <div className="result-section">
            <div className="coa-certificate">
              {/* Translucent background image */}
              {result.coa.imageUrl && (
                <div className="coa-bg-image">
                  <img
                    src={`${API_URL}/api/image/${result.coa.code}`}
                    alt=""
                    onError={(e) => e.target.parentElement.style.display = 'none'}
                  />
                </div>
              )}

              {/* Title bar */}
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

              {/* Two-column body */}
              <div className="cert-body">
                {/* Left: artwork thumbnail */}
                <div className="cert-left">
                  {result.coa.imageUrl && (
                    <img
                      src={`${API_URL}/api/image/${result.coa.code}`}
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

                {/* Right: content card */}
                <div className="cert-right">
                  <img src="/logo.png" alt="TrueCOA" className="cert-logo" />

                  <div className="cert-section">
                    <h3>Details</h3>
                    <div className="cert-detail"><span>Artist:</span><span>{result.coa.artist}</span></div>
                    <div className="cert-detail"><span>Title:</span><span>{result.coa.title}</span></div>
                    {result.coa.date && <div className="cert-detail"><span>Date:</span><span>{result.coa.date}</span></div>}
                    {result.coa.medium && <div className="cert-detail"><span>Medium:</span><span>{result.coa.medium}</span></div>}
                    {result.coa.size && <div className="cert-detail"><span>Dimensions:</span><span>{result.coa.size}</span></div>}
                    {result.coa.edition && <div className="cert-detail"><span>Edition:</span><span>{result.coa.edition}</span></div>}
                    {result.coa.condition && <div className="cert-detail"><span>Condition:</span><span>{result.coa.condition}</span></div>}
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
                    <div className="cert-detail cert-detail--multiline">
                      <span>Blockchain:</span>
                      <span>
                        <a href={blockchainUrl} target="_blank" rel="noopener noreferrer">
                          {displayLinkText(blockchainUrl, 'Polygon')}
                        </a>
                      </span>
                    </div>
                    {certificateUrl && (
                      <div className="cert-detail cert-detail--multiline">
                        <span>Certificate:</span>
                        <span>
                          <a href={certificateUrl} target="_blank" rel="noopener noreferrer">
                            {displayLinkText(certificateUrl, 'ScoreDetect')}
                          </a>
                        </span>
                      </div>
                    )}
                    {result.coa.completionDate && (
                      <div className="cert-detail">
                        <span>Date:</span>
                        <span>{formatDisplayDate(result.coa.completionDate)}</span>
                      </div>
                    )}
                    {result.coa.assignor && <div className="cert-detail"><span>Assignor:</span><span>{result.coa.assignor}</span></div>}
                    {result.coa.assignee && <div className="cert-detail"><span>Assignee:</span><span>{result.coa.assignee}</span></div>}
                    {nftUrl && (
                      <div className="cert-detail cert-detail--multiline">
                        <span>NFT:</span>
                        <span>
                          <a href={nftUrl} target="_blank" rel="noopener noreferrer">
                            {displayLinkText(nftUrl, result.blockchain?.tokenId ? `Token #${result.blockchain.tokenId}` : 'OpenSea')}
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
                        <div className="cert-auth-note">
                          {result.coa.authNotes}
                        </div>
                      )}
                    </div>
                  )}

                  {result.blockchain?.verified && (
                    <div className="cert-section">
                      <h3>NFT Record</h3>
                      <div className="cert-detail">
                        <span>Status:</span>
                        <span>Minted on {result.blockchain.network}</span>
                      </div>
                      <div className="cert-detail">
                        <span>Token ID:</span>
                        <span>{result.blockchain.tokenId}</span>
                      </div>
                      <div className="cert-detail cert-detail--multiline">
                        <span>Owner:</span>
                        <span>{result.blockchain.owner}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="cert-footer">
                <div className="cert-footer-meta">
                  {result.coa.authNotes && (
                    <div className="cert-footer-note">{result.coa.authNotes}</div>
                  )}
                  <div className="cert-footer-logos">
                    <span>Powered by:</span>
                    <a href={certificateUrl || 'https://scoredetect.com'} target="_blank" rel="noopener noreferrer" className="footer-partner">
                      <img src="/logo.png" alt="TrueCOA" />
                      <span>TrueCOA</span>
                    </a>
                    <a href={certificateUrl || 'https://scoredetect.com'} target="_blank" rel="noopener noreferrer" className="footer-partner">
                    <img src="/scoredetect.png" alt="ScoreDetect" />
                    <span>ScoreDetect</span>
                    </a>
                    <a href={blockchainUrl} target="_blank" rel="noopener noreferrer" className="footer-partner">
                      <img src="/polygon.png" alt="Polygon" />
                      <span>Polygon</span>
                    </a>
                  </div>
                </div>
                <div className="cert-footer-text">
                  Secured by Polygon blockchain.<br />Transparent Authenticity.
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
