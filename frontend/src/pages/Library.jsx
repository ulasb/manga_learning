import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, imageUrl } from '../api.js'
import AddSeriesModal from '../components/AddSeriesModal.jsx'
import AddBookModal from '../components/AddBookModal.jsx'

function Cover({ path, title }) {
  const url = imageUrl(path)
  if (url) return <img className="cover" src={url} alt={title} />
  return <div className="cover placeholder">{title}</div>
}

export default function Library() {
  const [tab, setTab] = useState('series')
  const [series, setSeries] = useState([])
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddSeries, setShowAddSeries] = useState(false)
  const [showAddBook, setShowAddBook] = useState(false)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    const [s, b] = await Promise.all([api.listSeries(), api.listBooks()])
    setSeries(s)
    setBooks(b)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="container">
      <div className="flex-between">
        <div className="tabs" style={{ border: 'none', marginBottom: 0 }}>
          <button className={tab === 'series' ? 'active' : ''} onClick={() => setTab('series')}>
            Series ({series.length})
          </button>
          <button className={tab === 'books' ? 'active' : ''} onClick={() => setTab('books')}>
            Shelf ({books.length})
          </button>
        </div>
        <div className="row">
          <button onClick={() => setShowAddBook(true)}>+ Book</button>
          <button className="primary" onClick={() => setShowAddSeries(true)}>
            + Series
          </button>
        </div>
      </div>
      <hr style={{ border: 'none', borderBottom: '1px solid var(--border)', margin: '14px 0 24px' }} />

      {loading ? (
        <div className="spinner">Loading…</div>
      ) : tab === 'series' ? (
        series.length === 0 ? (
          <div className="empty">
            No series yet. Click <strong>+ Series</strong> to search and add one.
          </div>
        ) : (
          <div className="grid">
            {series.map((s) => (
              <Link to={`/series/${s.id}`} className="card" key={s.id}>
                <Cover path={s.cover_path} title={s.title_romaji || s.title_native} />
                <div className="meta">
                  <div className="t">{s.title_romaji || s.title_native}</div>
                  <div className="s">
                    <span className={`badge ${s.status}`}>{s.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : books.length === 0 ? (
        <div className="empty">
          No books on your shelf. Click <strong>+ Book</strong> to add a volume or magazine.
        </div>
      ) : (
        <div className="grid">
          {books.map((b) => (
            <Link to={`/books/${b.id}`} className="card" key={b.id}>
              <Cover path={b.cover_path} title={b.title} />
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

      {showAddSeries && (
        <AddSeriesModal
          onClose={() => setShowAddSeries(false)}
          onAdded={(s) => {
            setShowAddSeries(false)
            navigate(`/series/${s.id}`)
          }}
        />
      )}
      {showAddBook && (
        <AddBookModal
          seriesList={series}
          onClose={() => setShowAddBook(false)}
          onAdded={(b) => {
            setShowAddBook(false)
            navigate(`/books/${b.id}`)
          }}
        />
      )}
    </div>
  )
}
