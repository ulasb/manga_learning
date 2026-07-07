import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, imageUrl } from '../api.js'

const STATUSES = ['want_to_read', 'reading', 'paused', 'completed', 'dropped']

export default function SeriesDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [series, setSeries] = useState(null)
  const [glossary, setGlossary] = useState([])
  const [books, setBooks] = useState([])

  async function load() {
    const [s, g, allBooks] = await Promise.all([
      api.getSeries(id),
      api.listGlossary(id),
      api.listBooks(),
    ])
    setSeries(s)
    setGlossary(g)
    // books directly linked OR containing an entry for this series
    const linked = []
    for (const b of allBooks) {
      const full = await api.getBook(b.id)
      if (
        full.series_id === Number(id) ||
        full.entries.some((e) => e.series_id === Number(id))
      ) {
        linked.push(full)
      }
    }
    setBooks(linked)
  }

  useEffect(() => {
    load()
  }, [id])

  async function changeStatus(e) {
    const updated = await api.updateSeries(id, { status: e.target.value })
    setSeries(updated)
  }

  async function remove() {
    if (!confirm('Remove this series from your library?')) return
    await api.deleteSeries(id)
    navigate('/')
  }

  if (!series) return <div className="container spinner">Loading…</div>

  const byType = glossary.reduce((acc, t) => {
    ;(acc[t.type] ||= []).push(t)
    return acc
  }, {})

  return (
    <div className="container">
      <div className="detail-head">
        {imageUrl(series.cover_path) ? (
          <img className="cover" src={imageUrl(series.cover_path)} alt="" />
        ) : (
          <div className="cover placeholder">{series.title_romaji}</div>
        )}
        <div style={{ flex: 1 }}>
          <h1>{series.title_romaji || series.title_native}</h1>
          {series.title_native && series.title_native !== series.title_romaji && (
            <div className="jp muted">{series.title_native}</div>
          )}
          {series.title_english && <div className="muted">{series.title_english}</div>}
          <div className="row" style={{ margin: '12px 0' }}>
            <select value={series.status} onChange={changeStatus} style={{ width: 'auto' }}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
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
          <button className="danger ghost" onClick={remove}>
            Remove series
          </button>
        </div>
      </div>

      <div className="section">
        <h2>Books</h2>
        {books.length === 0 ? (
          <p className="muted">
            No books linked yet. Add a volume or magazine from the Library, then it shows here.
          </p>
        ) : (
          <div className="grid">
            {books.map((b) => (
              <Link to={`/books/${b.id}`} className="card" key={b.id}>
                {imageUrl(b.cover_path) ? (
                  <img className="cover" src={imageUrl(b.cover_path)} alt="" />
                ) : (
                  <div className="cover placeholder">{b.title}</div>
                )}
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
          <p className="muted">
            Empty for now. As pages get translated, recurring terms, names, and vocab collect here.
          </p>
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
