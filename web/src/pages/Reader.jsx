import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../DataContext.jsx'

const FIT = { x: 0, y: 0, w: 1, h: 1 }
const PAD = 0.04

function parseBbox(s) {
  if (!s) return null
  try {
    const b = JSON.parse(s)
    return Array.isArray(b) && b.length === 4 ? b : null
  } catch {
    return null
  }
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

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
  const { q, resolveImage } = useData()

  const pages = useMemo(() => q.listPages(Number(bookId)), [q, bookId])
  const page = useMemo(() => (pageId ? q.getPage(Number(pageId)) : null), [q, pageId])
  const panels = page?.panels || []

  const [activeIdx, setActiveIdx] = useState(null)
  const [viewport, setViewport] = useState(FIT)
  const [pageUrl, setPageUrl] = useState(null)
  const [imgNat, setImgNat] = useState(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [dragging, setDragging] = useState(false)

  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const pendingFocus = useRef(null)

  // Redirect to the first page if none specified.
  useEffect(() => {
    if (!pageId && pages.length) navigate(`/read/${bookId}/${pages[0].id}`, { replace: true })
  }, [bookId, pageId, pages, navigate])

  // Resolve the page image (async) + reset view when the page changes.
  useEffect(() => {
    setViewport(FIT)
    setActiveIdx(null)
    setImgNat(null)
    setPageUrl(null)
    if (!page?.image_path) return
    let active = true
    resolveImage(page.image_path).then((url) => {
      if (!active || !url) return
      setPageUrl(url)
      const im = new Image()
      im.onload = () => active && setImgNat({ w: im.naturalWidth, h: im.naturalHeight })
      im.src = url
    })
    return () => {
      active = false
    }
  }, [page, resolveImage])

  // Measure the stage once it's mounted, keep it current on resize.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStageSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pages.length])

  const idx = pages.findIndex((p) => p.id === Number(pageId))
  const prevPage = idx > 0 ? pages[idx - 1] : null
  const nextPage = idx >= 0 && idx < pages.length - 1 ? pages[idx + 1] : null

  const focusPanel = useCallback(
    (panelIndex) => {
      setActiveIdx(panelIndex)
      const panel = panels.find((p) => p.panel_index === panelIndex)
      const bbox = parseBbox(panel?.bbox)
      if (bbox) setViewport(viewportForBbox(bbox))
      const el = document.getElementById(`panel-${panelIndex}`)
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    },
    [panels],
  )

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

  const gotoAdjacentTranslated = useCallback(
    (dir) => {
      for (let i = idx + dir; i >= 0 && i < pages.length; i += dir) {
        if (pages[i].panel_count > 0) {
          pendingFocus.current = dir > 0 ? 'first' : 'last'
          navigate(`/read/${bookId}/${pages[i].id}`)
          return
        }
      }
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
      gotoAdjacentTranslated(dir)
    },
    [panels, activeIdx, focusPanel, gotoAdjacentTranslated],
  )

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

  let bgStyle = {}
  if (pageUrl) {
    bgStyle.backgroundImage = `url(${pageUrl})`
    if (imgNat && stageSize.w && stageSize.h) {
      const { w: iw, h: ih } = imgNat
      const { w: cw, h: ch } = stageSize
      const { x: vx, y: vy, w: vw, h: vh } = viewport
      const scale = Math.min(cw / (vw * iw), ch / (vh * ih))
      bgStyle.backgroundSize = `${iw * scale}px ${ih * scale}px`
      bgStyle.backgroundPosition = `${-(vx * iw * scale) + (cw - vw * iw * scale) / 2}px ${
        -(vy * ih * scale) + (ch - vh * ih * scale) / 2
      }px`
      bgStyle.transition = dragging
        ? 'none'
        : 'background-position 0.28s ease, background-size 0.28s ease'
    } else {
      bgStyle.backgroundSize = 'contain'
      bgStyle.backgroundPosition = 'center'
    }
  }

  const containScale =
    imgNat && stageSize.w
      ? Math.min(stageSize.w / (viewport.w * imgNat.w), stageSize.h / (viewport.h * imgNat.h))
      : 1

  const onWheel = (e) => {
    if (!imgNat) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 0.85 : 1 / 0.85
    setViewport((v) => {
      const cx = v.x + v.w / 2
      const cy = v.y + v.h / 2
      const nw = clamp(v.w * factor, 0.03, 1)
      const nh = clamp(v.h * factor, 0.03, 1)
      return { w: nw, h: nh, x: clamp(cx - nw / 2, 0, 1 - nw), y: clamp(cy - nh / 2, 0, 1 - nh) }
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
        <div className="empty">No pages in this book.</div>
      </div>
    )
  }

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

        {panels.length === 0 ? (
          <div className="hint">Not translated.</div>
        ) : (
          panels.map((p) => (
            <div id={`panel-${p.panel_index}`} key={p.id}>
              <Panel p={p} active={p.panel_index === activeIdx} onClick={() => focusPanel(p.panel_index)} />
            </div>
          ))
        )}
        {page?.notes && (
          <div className="notes" style={{ marginTop: 12 }}>
            <strong>Page note:</strong> {page.notes}
          </div>
        )}
      </div>
    </div>
  )
}
