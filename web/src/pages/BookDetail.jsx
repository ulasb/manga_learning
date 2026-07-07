import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useData } from '../DataContext.jsx'
import LocalImage from '../components/LocalImage.jsx'

export default function BookDetail() {
  const { id } = useParams()
  const bid = Number(id)
  const { q } = useData()
  const navigate = useNavigate()

  const book = useMemo(() => q.getBook(bid), [q, bid])
  const pages = useMemo(() => q.listPages(bid), [q, bid])

  if (!book) return <div className="container spinner">Not found.</div>
  const isMagazine = book.kind === 'magazine' || book.kind === 'anthology'
  const seriesName = (sid) => {
    const s = q.getSeries(sid)
    return s ? s.title_romaji || s.title_native : '— unknown —'
  }

  return (
    <div className="container">
      <div className="detail-head">
        <LocalImage className="cover" path={book.cover_path} fallback={book.title} />
        <div style={{ flex: 1 }}>
          <h1>{book.title}</h1>
          <div className="muted">
            <span className="badge">{book.kind}</span>{' '}
            {book.volume_number ? `Vol. ${book.volume_number}` : book.issue_label || ''}
            {book.publisher ? ` · ${book.publisher}` : ''}
            {book.year ? ` · ${book.year}` : ''}
          </div>
          {pages.length > 0 && (
            <div className="row" style={{ marginTop: 16 }}>
              <button className="primary" onClick={() => navigate(`/read/${book.id}`)}>
                Read →
              </button>
            </div>
          )}
        </div>
      </div>

      {isMagazine && book.entries.length > 0 && (
        <div className="section">
          <h2>Contents ({book.entries.length})</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Series</th>
                <th>Chapter</th>
                <th>Pages</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h2>Pages ({pages.length})</h2>
        {pages.length === 0 ? (
          <div className="empty">No pages.</div>
        ) : (
          <div className="thumbs">
            {pages.map((p) => (
              <Link to={`/read/${book.id}/${p.id}`} className="thumb" key={p.id}>
                <LocalImage path={p.image_path} fallback="no image" />
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
