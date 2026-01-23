import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
    const authenticateMatch = path.match(/\/(?:AUTHENTICATE|authenticate|verify)\/(\d+)/i)
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

  return (
    <div className="app">
      <header>
        <div className="logo">
          <img src="/logo.png" alt="Gauntlet Gallery" className="logo-image" />
        </div>
      </header>

      <main>
        {!result ? (
          <div className="verify-section">
            <h1>Certificate of Authenticity</h1>
            <p className="subtitle">Verify your artwork's authenticity with blockchain-backed certification</p>

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
            <div className="coa-card">
              <div className="coa-header">
                <h2>Certificate of Authenticity</h2>
                <div className={`verification-badge ${result.blockchain?.verified ? 'verified' : 'pending'}`}>
                  {result.blockchain?.verified ? (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/>
                      </svg>
                      Blockchain Verified
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      Authenticated
                    </>
                  )}
                </div>
              </div>

              {result.coa.imageUrl && (
                <div className="coa-artwork">
                  <img
                    src={`${API_URL}/api/image/${result.coa.code}`}
                    alt={result.coa.title}
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}

              <div className="coa-details">
                <div className="detail-row highlight">
                  <span className="label">COA Code</span>
                  <span className="value">{result.coa.code}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Artist</span>
                  <span className="value">{result.coa.artist}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Title</span>
                  <span className="value">{result.coa.title}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Date</span>
                  <span className="value">{result.coa.date}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Dimensions</span>
                  <span className="value">
                    {result.coa.dimensions.length}" x {result.coa.dimensions.width}"
                  </span>
                </div>
                {result.coa.edition && (
                  <div className="detail-row">
                    <span className="label">Edition</span>
                    <span className="value">
                      {result.coa.number} of {result.coa.edition}
                    </span>
                  </div>
                )}
                {result.coa.history && (
                  <div className="detail-row">
                    <span className="label">Provenance</span>
                    <span className="value">{result.coa.history}</span>
                  </div>
                )}
              </div>

              {result.blockchain?.verified && (
                <div className="blockchain-info">
                  <h3>Blockchain Record</h3>
                  <div className="blockchain-details">
                    <div className="detail-row">
                      <span className="label">Token ID</span>
                      <span className="value">#{result.blockchain.tokenId}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Network</span>
                      <span className="value">{result.blockchain.network}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Contract</span>
                      <span className="value address">
                        <a
                          href={`https://polygonscan.com/address/${result.blockchain.contractAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {result.blockchain.contractAddress.slice(0, 6)}...{result.blockchain.contractAddress.slice(-4)}
                        </a>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="coa-footer">
                <div className="coa-footer-left">
                  <img src="/logo.png" alt="Gauntlet Gallery" className="coa-footer-logo" />
                </div>
                <div className="coa-footer-center">
                  <p>Verified on {new Date(result.verifiedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</p>
                </div>
                <div className="coa-footer-right">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin + '/AUTHENTICATE/' + result.coa.code)}`}
                    alt="QR Code"
                    className="coa-footer-qr"
                  />
                  <span className="qr-code-label">{result.coa.code}</span>
                </div>
              </div>

              <div className="verification-partners">
                <a
                  href="https://explorer.scoredetect.com/certificate/b0066589-8263-4ece-92d4-321b51778412"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="partner-badge"
                >
                  <img src="/scoredetect.png" alt="ScoreDetect" />
                  <span>Content Verified</span>
                </a>
                {result.blockchain?.verified ? (
                  <a
                    href={`https://polygonscan.com/token/${result.blockchain.contractAddress}?a=${result.blockchain.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="partner-badge"
                  >
                    <img src="/polygon.png" alt="Polygon" />
                    <span>NFT Verified</span>
                  </a>
                ) : (
                  <div className="partner-badge pending">
                    <img src="/polygon.png" alt="Polygon" />
                    <span>NFT Pending</span>
                  </div>
                )}
              </div>
            </div>

            <button className="back-btn" onClick={resetForm}>
              Verify Another Certificate
            </button>
          </div>
        )}
      </main>

      <footer>
        <p>&copy; {new Date().getFullYear()} Gauntlet Gallery. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
