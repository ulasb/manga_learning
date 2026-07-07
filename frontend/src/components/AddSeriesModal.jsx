import { useState } from 'react'
import { api } from '../api.js'

// Search AniList/MangaDex/Google Books by title (romaji or Japanese) or ISBN,
// show candidates, and add the chosen one to the library.
export default function AddSeriesModal({ onClose, onAdded }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(null)

  async function runSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResults(await api.search(query.trim()))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function add(c) {
    setAdding(c.source_id)
    setError(null)
    try {
      const series = await api.createSeries({
        title_romaji: c.title_romaji,
        title_native: c.title_native,
        title_english: c.title_english,
        source: c.source,
        source_id: c.source_id,
        author: c.author,
        description: c.description,
        cover_url: c.cover_url,
        status: 'want_to_read',
        format: c.format,
        year: c.year,
        volume_count: c.volume_count,
        chapter_count: c.chapter_count,
        genres: c.genres || [],
      })
      onAdded(series)
    } catch (err) {
      setError(err.message)
      setAdding(null)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close ghost" onClick={onClose}>
          ✕
        </button>
        <h2>Add a series</h2>
        <p className="muted">Search by title (romaji or 日本語) or by ISBN.</p>
        <form onSubmit={runSearch} className="row">
          <input
            autoFocus
            placeholder="e.g. Kimetsu no Yaiba, 鬼滅の刃, or 9784088807232"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        <div style={{ marginTop: 16 }}>
          {results.map((c) => (
            <div className="candidate" key={`${c.source}-${c.source_id}`}>
              {c.cover_url ? (
                <img src={c.cover_url} alt="" />
              ) : (
                <div className="candidate-img" style={{ width: 56, height: 80 }} />
              )}
              <div className="info">
                <div className="src-tag">{c.source}</div>
                <div className="t">{c.title_romaji || c.title_native || c.title_english}</div>
                <div className="sub">
                  {c.title_native && c.title_native !== c.title_romaji ? `${c.title_native} · ` : ''}
                  {c.author || 'Unknown author'}
                  {c.year ? ` · ${c.year}` : ''}
                  {c.volume_count ? ` · ${c.volume_count} vol` : ''}
                  {c.isbn ? ` · ISBN ${c.isbn}` : ''}
                </div>
              </div>
              <button className="primary" onClick={() => add(c)} disabled={adding === c.source_id}>
                {adding === c.source_id ? 'Adding…' : 'Add'}
              </button>
            </div>
          ))}
          {!loading && query && results.length === 0 && !error && (
            <p className="muted">No matches yet — try the romaji or Japanese title.</p>
          )}
        </div>
      </div>
    </div>
  )
}
