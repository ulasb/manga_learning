import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../DataContext.jsx'
import LocalImage from '../components/LocalImage.jsx'

export default function SeriesDetail() {
  const { id } = useParams()
  const sid = Number(id)
  const { q } = useData()

  const series = useMemo(() => q.getSeries(sid), [q, sid])
  const glossary = useMemo(() => q.listGlossary(sid), [q, sid])
  const books = useMemo(
    () =>
      q
        .listBooks()
        .map((b) => q.getBook(b.id))
        .filter((b) => b.series_id === sid || b.entries.some((e) => e.series_id === sid)),
    [q, sid],
  )

  if (!series) return <div className="container spinner">Not found.</div>

  const byType = glossary.reduce((acc, t) => {
    ;(acc[t.type] ||= []).push(t)
    return acc
  }, {})

  return (
    <div className="container">
      <div className="detail-head">
        <LocalImage className="cover" path={series.cover_path} fallback={series.title_romaji} />
        <div style={{ flex: 1 }}>
          <h1>{series.title_romaji || series.title_native}</h1>
          {series.title_native && series.title_native !== series.title_romaji && (
            <div className="jp muted">{series.title_native}</div>
          )}
          {series.title_english && <div className="muted">{series.title_english}</div>}
          <div className="row" style={{ margin: '12px 0' }}>
            <span className={`badge ${series.status}`}>{(series.status || '').replace(/_/g, ' ')}</span>
            <span className="muted">
              {series.author}
              {series.year ? ` · ${series.year}` : ''}
              {series.volume_count ? ` · ${series.volume_count} vol` : ''}
            </span>
          </div>
          {series.description && (
            <p className="muted" style={{ maxWidth: 640, lineHeight: 1.5 }}>
              {series.description.slice(0, 500)}
              {series.description.length > 500 ? '…' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="section">
        <h2>Books</h2>
        {books.length === 0 ? (
          <p className="muted">No books linked.</p>
        ) : (
          <div className="grid">
            {books.map((b) => (
              <Link to={`/books/${b.id}`} className="card" key={b.id}>
                <LocalImage className="cover" path={b.cover_path} fallback={b.title} />
                <div className="meta">
                  <div className="t">{b.title}</div>
                  <div className="s">
                    <span className="badge">{b.kind}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h2>Glossary &amp; study list ({glossary.length})</h2>
        {glossary.length === 0 ? (
          <p className="muted">Empty.</p>
        ) : (
          Object.entries(byType).map(([type, terms]) => (
            <div key={type} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                {type}
              </h3>
              <table>
                <tbody>
                  {terms.map((t) => (
                    <tr key={t.id}>
                      <td className="jp" style={{ width: 120 }}>
                        {t.term}
                      </td>
                      <td style={{ width: 140 }} className="muted">
                        {t.reading} {t.romaji ? `· ${t.romaji}` : ''}
                      </td>
                      <td>{t.meaning}</td>
                      <td className="muted">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
