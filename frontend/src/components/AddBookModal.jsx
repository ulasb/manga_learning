import { useState } from 'react'
import { api } from '../api.js'

// Create a physical book: a single-series volume, or a magazine/anthology.
// For a volume, link the series so one entry is auto-created. For a magazine,
// leave the series empty here and attach per-chapter entries on its detail page.
export default function AddBookModal({ seriesList, onClose, onAdded }) {
  const [form, setForm] = useState({
    kind: 'volume',
    title: '',
    series_id: '',
    volume_number: '',
    issue_label: '',
    isbn: '',
    publisher: '',
    year: '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const isMagazine = form.kind === 'magazine' || form.kind === 'anthology'

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const book = await api.createBook({
        kind: form.kind,
        title: form.title.trim(),
        series_id: !isMagazine && form.series_id ? Number(form.series_id) : null,
        volume_number: form.volume_number ? Number(form.volume_number) : null,
        issue_label: form.issue_label || null,
        isbn: form.isbn || null,
        publisher: form.publisher || null,
        year: form.year ? Number(form.year) : null,
      })
      onAdded(book)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close ghost" onClick={onClose}>
          ✕
        </button>
        <h2>Add a book</h2>
        <form onSubmit={save}>
          <label>Type</label>
          <select value={form.kind} onChange={set('kind')}>
            <option value="volume">Single-series volume (tankōbon)</option>
            <option value="magazine">Magazine (e.g. Shōnen Jump)</option>
            <option value="anthology">Anthology</option>
            <option value="other">Other</option>
          </select>

          <label>Title</label>
          <input
            value={form.title}
            onChange={set('title')}
            placeholder={isMagazine ? '週刊少年ジャンプ 2024年30号' : '鬼滅の刃 1'}
            autoFocus
          />

          {isMagazine ? (
            <>
              <div className="hint">
                After creating the magazine, open it to add chapter entries — each maps a page
                range to a series.
              </div>
              <label>Issue label</label>
              <input value={form.issue_label} onChange={set('issue_label')} placeholder="2024 No.30" />
            </>
          ) : (
            <>
              <label>Series (link to your library)</label>
              <select value={form.series_id} onChange={set('series_id')}>
                <option value="">— none —</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title_romaji || s.title_native}
                  </option>
                ))}
              </select>
              <label>Volume number</label>
              <input type="number" value={form.volume_number} onChange={set('volume_number')} placeholder="1" />
            </>
          )}

          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>ISBN</label>
              <input value={form.isbn} onChange={set('isbn')} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Year</label>
              <input type="number" value={form.year} onChange={set('year')} />
            </div>
          </div>
          <label>Publisher</label>
          <input value={form.publisher} onChange={set('publisher')} placeholder="集英社" />

          {error && <div className="error">{error}</div>}
          <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
