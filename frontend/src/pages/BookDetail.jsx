import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, imageUrl } from '../api.js'

function EntryEditor({ book, seriesList, onChange }) {
  const [form, setForm] = useState({
    series_id: '',
    title: '',
    chapter_number: '',
    start_page: '',
    end_page: '',
  })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function add(e) {
    e.preventDefault()
    await api.createEntry(book.id, {
      series_id: form.series_id ? Number(form.series_id) : null,
      title: form.title || null,
      chapter_number: form.chapter_number || null,
      order_index: book.entries.length,
      start_page: form.start_page ? Number(form.start_page) : null,
      end_page: form.end_page ? Number(form.end_page) : null,
    })
    setForm({ series_id: '', title: '', chapter_number: '', start_page: '', end_page: '' })
    onChange()
  }

  async function del(id) {
    await api.deleteEntry(id)
    onChange()
  }

  const seriesName = (sid) => {
    const s = seriesList.find((x) => x.id === sid)
    return s ? s.title_romaji || s.title_native : '— unknown —'
  }

  return (
    <div className="section">
      <h2>Contents ({book.entries.length})</h2>
      <p className="muted">Each entry maps a page range in this book to one series.</p>
      {book.entries.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Series</th>
              <th>Chapter</th>
              <th>Pages</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {book.entries.map((en) => (
              <tr key={en.id}>
                <td>{en.order_index + 1}</td>
                <td>
                  {en.series_id ? (
                    <Link to={`/series/${en.series_id}`}>{seriesName(en.series_id)}</Link>
                  ) : (
                    <span className="muted">{en.title || 'filler / unknown'}</span>
                  )}
                </td>
                <td>{en.chapter_number || '—'}</td>
                <td className="muted">
                  {en.start_page && en.end_page ? `${en.start_page}–${en.end_page}` : '—'}
                </td>
                <td>
                  <button className="danger ghost" onClick={() => del(en.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={add} className="row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 2 }}>
          <label>Series</label>
          <select value={form.series_id} onChange={set('series_id')}>
            <option value="">— filler / unknown —</option>
            {seriesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title_romaji || s.title_native}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label>Chapter</label>
          <input value={form.chapter_number} onChange={set('chapter_number')} placeholder="1090" />
        </div>
        <div style={{ width: 80 }}>
          <label>From pg</label>
          <input type="number" value={form.start_page} onChange={set('start_page')} />
        </div>
        <div style={{ width: 80 }}>
          <label>To pg</label>
          <input type="number" value={form.end_page} onChange={set('end_page')} />
        </div>
        <button className="primary" type="submit">
          Add entry
        </button>
      </form>
      <p className="hint">
        Don't see a series? Add it from the Library first (so its cover and glossary exist), then
        link it here.
      </p>
    </div>
  )
}

export default function BookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [pages, setPages] = useState([])
  const [seriesList, setSeriesList] = useState([])
  const [startPage, setStartPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  async function load() {
    const [b, pg, s] = await Promise.all([api.getBook(id), api.listPages(id), api.listSeries()])
    setBook(b)
    setPages(pg)
    setSeriesList(s)
    if (pg.length) setStartPage(Math.max(...pg.map((p) => p.page_number)) + 1)
  }

  useEffect(() => {
    load()
  }, [id])

  async function uploadFiles(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    let n = Number(startPage)
    for (const file of files) {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('page_number', n)
      await api.uploadPage(id, fd)
      n += 1
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  async function remove() {
    if (!confirm('Delete this book and all its pages?')) return
    await api.deleteBook(id)
    navigate('/')
  }

  if (!book) return <div className="container spinner">Loading…</div>
  const isMagazine = book.kind === 'magazine' || book.kind === 'anthology'

  return (
    <div className="container">
      <div className="detail-head">
        {imageUrl(book.cover_path) ? (
          <img className="cover" src={imageUrl(book.cover_path)} alt="" />
        ) : (
          <div className="cover placeholder">{book.title}</div>
        )}
        <div style={{ flex: 1 }}>
          <h1>{book.title}</h1>
          <div className="muted">
            <span className="badge">{book.kind}</span>{' '}
            {book.volume_number ? `Vol. ${book.volume_number}` : book.issue_label || ''}
            {book.publisher ? ` · ${book.publisher}` : ''}
            {book.year ? ` · ${book.year}` : ''}
            {book.isbn ? ` · ISBN ${book.isbn}` : ''}
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            {pages.length > 0 && (
              <button className="primary" onClick={() => navigate(`/read/${book.id}`)}>
                Read →
              </button>
            )}
            <button className="danger ghost" onClick={remove}>
              Delete book
            </button>
          </div>
        </div>
      </div>

      {isMagazine && <EntryEditor book={book} seriesList={seriesList} onChange={load} />}

      <div className="section">
        <h2>Pages ({pages.length})</h2>
        <div className="toolbar">
          <div className="row">
            <label style={{ margin: 0 }}>Start at page</label>
            <input
              type="number"
              value={startPage}
              onChange={(e) => setStartPage(e.target.value)}
              style={{ width: 80 }}
            />
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={uploadFiles} hidden />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : '⬆ Upload images'}
          </button>
          <button onClick={() => navigate(`/read/${book.id}`)}>
            📷 Capture / read with webcam
          </button>
        </div>
        <p className="hint">
          Upload scans/photos, or use webcam capture inside the reader. Then tell Claude “translate
          the new pages for {book.title}” — it reads the images and writes the panels back here.
        </p>

        {pages.length === 0 ? (
          <div className="empty">No pages yet.</div>
        ) : (
          <div className="thumbs">
            {pages.map((p) => (
              <Link to={`/read/${book.id}/${p.id}`} className="thumb" key={p.id}>
                {imageUrl(p.image_path) ? (
                  <img src={imageUrl(p.image_path)} alt={`page ${p.page_number}`} />
                ) : (
                  <div className="cover placeholder">no image</div>
                )}
                <div className="lbl">
                  <span>p.{p.page_number}</span>
                  <span className={`badge ${p.status}`} style={{ fontSize: 9, padding: '0 4px' }}>
                    {p.status === 'translated' ? '✓' : p.status === 'untranslated' ? '·' : '…'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
