import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, imageUrl } from '../api.js'
import CameraCapture from '../components/CameraCapture.jsx'

const FIT = { x: 0, y: 0, w: 1, h: 1 }
const PAD = 0.04 // small margin around a focused panel frame (boxes already cover the full panel)

function parseBbox(s) {
  if (!s) return null
  try {
    const b = JSON.parse(s)
    return Array.isArray(b) && b.length === 4 ? b : null
  } catch {
    return null
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

// A padded viewport (normalized) for a panel's bbox, clamped to the image.
function viewportForBbox([x, y, w, h]) {
  const vx = clamp(x - w * PAD, 0, 1)
  const vy = clamp(y - h * PAD, 0, 1)
  const vw = clamp(w * (1 + 2 * PAD), 0.02, 1 - vx)
  const vh = clamp(h * (1 + 2 * PAD), 0.02, 1 - vy)
  return { x: vx, y: vy, w: vw, h: vh }
}

function Panel({ p, active, onClick }) {
  return (
    <div
      className={`panel-item${p.needs_context ? ' needs-context' : ''}${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <div className="ph">
        <span className="pidx">{p.panel_index}</span>
        <span className="badge">{p.panel_type}</span>
        {p.speaker && <span className="speaker">{p.speaker}</span>}
        {p.bbox ? null : <span className="badge" title="no zoom region">⊘ no region</span>}
      </div>
      {p.original_text && <div className="jp-orig">{p.original_text}</div>}
      {p.reading && <div className="reading">{p.reading}</div>}
      {p.romaji && <div className="reading">{p.romaji}</div>}
      {p.translation && <div className="tl">{p.translation}</div>}
      {p.literal && <div className="literal">lit. {p.literal}</div>}
      {p.notes && <div className="notes">{p.notes}</div>}
    </div>
  )
}

export default function Reader() {
  const { bookId, pageId } = useParams()
  const navigate = useNavigate()
  const [pages, setPages] = useState([])
  const [page, setPage] = useState(null)
  const [showCamera, setShowCamera] = useState(false)

  const [activeIdx, setActiveIdx] = useState(null) // active panel_index, or null = fit
  const [viewport, setViewport] = useState(FIT)
  const [imgNat, setImgNat] = useState(null) // {w,h}
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [dragging, setDragging] = useState(false)

  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const pendingFocus = useRef(null) // 'first' | 'last' after a cross-page step

  async function loadPages() {
    const pg = await api.listPages(bookId)
    setPages(pg)
    return pg
  }

  useEffect(() => {
    loadPages().then((pg) => {
      if (!pageId && pg.length) navigate(`/read/${bookId}/${pg[0].id}`, { replace: true })
    })
  }, [bookId])

  // Load page + reset view; measure natural image size.
  useEffect(() => {
    if (!pageId) return
    setViewport(FIT)
    setActiveIdx(null)
    setImgNat(null)
    api.getPage(pageId).then((p) => {
      setPage(p)
      const url = imageUrl(p.image_path)
      if (url) {
        const im = new Image()
        im.onload = () => setImgNat({ w: im.naturalWidth, h: im.naturalHeight })
        im.src = url
      }
    })
  }, [pageId])

  // Measure the stage and keep it current on resize.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStageSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pages.length]) // re-run once the stage actually mounts (after pages load)

  const idx = pages.findIndex((p) => p.id === Number(pageId))
  const prevPage = idx > 0 ? pages[idx - 1] : null
  const nextPage = idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : null
  const panels = page?.panels || []

  const focusPanel = useCallback((panelIndex) => {
    setActiveIdx(panelIndex)
    const panel = panels.find((p) => p.panel_index === panelIndex)
    const bbox = parseBbox(panel?.bbox)
    if (bbox) setViewport(viewportForBbox(bbox))
    // if no bbox: keep current viewport, just highlight + scroll sidebar
    const el = document.getElementById(`panel-${panelIndex}`)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [panels])

  // After a cross-page navigation, focus first/last panel of the new page.
  useEffect(() => {
    if (!page || pendingFocus.current == null) return
    if (panels.length) {
      const target = pendingFocus.current === 'last' ? panels[panels.length - 1] : panels[0]
      focusPanel(target.panel_index)
    }
    pendingFocus.current = null
  }, [page, panels, focusPanel])

  const fitPage = () => {
    setViewport(FIT)
    setActiveIdx(null)
  }

  // Jump to the nearest page in `dir` that actually has panels (skip ads /
  // untranslated front-matter). Returns true if it navigated.
  const gotoAdjacentTranslated = useCallback(
    (dir) => {
      for (let i = idx + dir; i >= 0 && i < pages.length; i += dir) {
        if (pages[i].panel_count > 0) {
          pendingFocus.current = dir > 0 ? 'first' : 'last'
          navigate(`/read/${bookId}/${pages[i].id}`)
          return true
        }
      }
      return false
    },
    [idx, pages, bookId, navigate],
  )

  const stepPanel = useCallback(
    (dir) => {
      if (panels.length) {
        const cur = panels.findIndex((p) => p.panel_index === activeIdx)
        const next = cur < 0 ? (dir > 0 ? 0 : panels.length - 1) : cur + dir
        if (next >= 0 && next < panels.length) {
          focusPanel(panels[next].panel_index)
          return
        }
      }
      // at a chapter edge (or on an untranslated page) — hop to adjacent translated page
      gotoAdjacentTranslated(dir)
    },
    [panels, activeIdx, focusPanel, gotoAdjacentTranslated],
  )

  // Keyboard: →/Space advance a panel, ← go back, F fit.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        stepPanel(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepPanel(-1)
      } else if (e.key === 'f' || e.key === 'F') {
        fitPage()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepPanel])

  // --- compute background style from the current viewport ---
  let bgStyle = {}
  if (page && imageUrl(page.image_path)) {
    bgStyle.backgroundImage = `url(${imageUrl(page.image_path)})`
    if (imgNat && stageSize.w && stageSize.h) {
      const { w: iw, h: ih } = imgNat
      const { w: cw, h: ch } = stageSize
      const { x: vx, y: vy, w: vw, h: vh } = viewport
      const scale = Math.min(cw / (vw * iw), ch / (vh * ih))
      const DW = iw * scale
      const DH = ih * scale
      const posX = -(vx * iw * scale) + (cw - vw * iw * scale) / 2
      const posY = -(vy * ih * scale) + (ch - vh * ih * scale) / 2
      bgStyle.backgroundSize = `${DW}px ${DH}px`
      bgStyle.backgroundPosition = `${posX}px ${posY}px`
      bgStyle.transition = dragging ? 'none' : 'background-position 0.28s ease, background-size 0.28s ease'
    } else {
      bgStyle.backgroundSize = 'contain'
      bgStyle.backgroundPosition = 'center'
    }
  }

  const containScale =
    imgNat && stageSize.w
      ? Math.min(stageSize.w / (viewport.w * imgNat.w), stageSize.h / (viewport.h * imgNat.h))
      : 1

  // Wheel: zoom around the stage center.
  const onWheel = (e) => {
    if (!imgNat) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 0.85 : 1 / 0.85
    setViewport((v) => {
      const cx = v.x + v.w / 2
      const cy = v.y + v.h / 2
      const nw = clamp(v.w * factor, 0.03, 1)
      const nh = clamp(v.h * factor, 0.03, 1)
      return {
        w: nw,
        h: nh,
        x: clamp(cx - nw / 2, 0, 1 - nw),
        y: clamp(cy - nh / 2, 0, 1 - nh),
      }
    })
  }

  const onMouseDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  const onMouseMove = (e) => {
    if (!dragRef.current || !imgNat) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    dragRef.current = { x: e.clientX, y: e.clientY }
    setViewport((v) => ({
      ...v,
      x: clamp(v.x - dx / (imgNat.w * containScale), 0, 1 - v.w),
      y: clamp(v.y - dy / (imgNat.h * containScale), 0, 1 - v.h),
    }))
  }
  const endDrag = () => {
    dragRef.current = null
    setDragging(false)
  }

  if (pages.length === 0) {
    return (
      <div className="container">
        <Link to={`/books/${bookId}`} className="muted">
          ← Back to book
        </Link>
        <div className="empty">
          No pages yet.
          <button className="primary" style={{ marginLeft: 8 }} onClick={() => setShowCamera(true)}>
            📷 Capture with webcam
          </button>
        </div>
        {showCamera && (
          <CameraCapture
            bookId={bookId}
            startPage={1}
            onCaptured={loadPages}
            onClose={() => loadPages().then(() => setShowCamera(false))}
          />
        )}
      </div>
    )
  }

  const hasBboxes = panels.some((p) => parseBbox(p.bbox))

  return (
    <div className="reader">
      <div
        className={`imgpane stage${dragging ? ' grabbing' : ''}`}
        ref={stageRef}
        style={bgStyle}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onDoubleClick={fitPage}
        title="Scroll to zoom · drag to pan · double-click to fit"
      >
        {!page?.image_path && <div className="muted">No image for this page.</div>}
        <div className="stage-hud">
          {activeIdx ? `panel ${activeIdx} / ${panels.length}` : 'fit page'}
        </div>
      </div>

      <div className="sidepane">
        <div className="pagenav">
          <Link to={`/books/${bookId}`} className="muted" style={{ marginRight: 'auto' }}>
            ← book
          </Link>
          <button onClick={() => prevPage && navigate(`/read/${bookId}/${prevPage.id}`)} disabled={!prevPage}>
            ◀
          </button>
          <span className="num">
            p.{page?.page_number} · {idx + 1}/{pages.length}
          </span>
          <button onClick={() => nextPage && navigate(`/read/${bookId}/${nextPage.id}`)} disabled={!nextPage}>
            ▶
          </button>
        </div>

        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button onClick={() => stepPanel(-1)} title="Previous panel (←)">
            ‹ panel
          </button>
          <button className="primary" onClick={() => stepPanel(1)} title="Next panel (→ or Space)">
            panel ›
          </button>
          <button onClick={fitPage} title="Fit whole page (F)">
            ⤢ fit
          </button>
        </div>

        {!hasBboxes && panels.length > 0 && (
          <div className="hint">
            Panel-zoom regions aren’t set for this page yet, so stepping highlights panels but won’t
            zoom. Scroll-to-zoom and drag-to-pan on the image still work.
          </div>
        )}

        {panels.length === 0 ? (
          <div className="hint">Not translated yet.</div>
        ) : (
          panels.map((p) => (
            <div id={`panel-${p.panel_index}`} key={p.id}>
              <Panel
                p={p}
                active={p.panel_index === activeIdx}
                onClick={() => focusPanel(p.panel_index)}
              />
            </div>
          ))
        )}
      </div>

      {showCamera && (
        <CameraCapture
          bookId={bookId}
          startPage={pages.length ? Math.max(...pages.map((p) => p.page_number)) + 1 : 1}
          onCaptured={loadPages}
          onClose={() => loadPages().then(() => setShowCamera(false))}
        />
      )}
    </div>
  )
}
