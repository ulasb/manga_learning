import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

// Capture page images straight from a webcam (getUserMedia works on localhost
// without HTTPS). Each capture posts to the book as the next page number.
export default function CameraCapture({ bookId, startPage, onCaptured, onClose }) {
  const videoRef = useRef()
  const canvasRef = useRef()
  const streamRef = useRef(null)
  const [page, setPage] = useState(startPage)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [lastShot, setLastShot] = useState(null)

  useEffect(() => {
    let active = true
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 2560 }, height: { ideal: 1440 }, facingMode: 'environment' },
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        setError(`Camera unavailable: ${err.message}`)
      }
    }
    start()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('image', blob, `page-${page}.jpg`)
      fd.append('page_number', page)
      const saved = await api.uploadPage(bookId, fd)
      setLastShot(URL.createObjectURL(blob))
      setPage(Number(page) + 1)
      onCaptured?.(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal camera" onClick={(e) => e.stopPropagation()}>
        <button className="close ghost" onClick={onClose}>
          ✕
        </button>
        <h2>Capture pages</h2>
        {error && <div className="error">{error}</div>}
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="row" style={{ marginTop: 14, alignItems: 'flex-end' }}>
          <div>
            <label>Page number</label>
            <input
              type="number"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              style={{ width: 90 }}
            />
          </div>
          <button className="primary" onClick={capture} disabled={busy || !!error}>
            {busy ? 'Saving…' : '📷 Capture page'}
          </button>
          {lastShot && <span className="muted">Saved page {Number(page) - 1} ✓</span>}
          <div className="spacer" style={{ flex: 1 }} />
          <button onClick={onClose}>Done</button>
        </div>
        <p className="hint">
          Point at the page and capture. The page number auto-increments, so you can shoot a whole
          chapter in a row.
        </p>
      </div>
    </div>
  )
}
