import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../DataContext.jsx'
import LocalImage from '../components/LocalImage.jsx'

export default function Library() {
  const { q } = useData()
  const [tab, setTab] = useState('series')
  const series = useMemo(() => q.listSeries(), [q])
  const books = useMemo(() => q.listBooks(), [q])

  return (
    <div className="container">
      <div className="tabs" style={{ border: 'none', marginBottom: 0 }}>
        <button className={tab === 'series' ? 'active' : ''} onClick={() => setTab('series')}>
          Series ({series.length})
        </button>
        <button className={tab === 'books' ? 'active' : ''} onClick={() => setTab('books')}>
          Shelf ({books.length})
        </button>
      </div>
      <hr style={{ border: 'none', borderBottom: '1px solid var(--border)', margin: '14px 0 24px' }} />

      {tab === 'series' ? (
        series.length === 0 ? (
          <div className="empty">No series in this library.</div>
        ) : (
          <div className="grid">
            {series.map((s) => (
              <Link to={`/series/${s.id}`} className="card" key={s.id}>
                <LocalImage
                  className="cover"
                  path={s.cover_path}
                  fallback={s.title_romaji || s.title_native}
                />
                <div className="meta">
                  <div className="t">{s.title_romaji || s.title_native}</div>
                  <div className="s">
                    <span className={`badge ${s.status}`}>{(s.status || '').replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : books.length === 0 ? (
        <div className="empty">No books on the shelf.</div>
      ) : (
        <div className="grid">
          {books.map((b) => (
            <Link to={`/books/${b.id}`} className="card" key={b.id}>
              <LocalImage className="cover" path={b.cover_path} fallback={b.title} />
              <div className="meta">
                <div className="t">{b.title}</div>
                <div className="s">
                  <span className="badge">{b.kind}</span>{' '}
                  {b.volume_number ? `Vol. ${b.volume_number}` : b.issue_label || ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
