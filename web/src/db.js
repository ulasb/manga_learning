// In-browser SQLite via sql.js (WebAssembly). Opens the library's manga.db
// (read from the local folder) and exposes the read queries the reader needs —
// a client-side stand-in for the FastAPI backend.
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

let DB = null

export async function openDb(bytes) {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  DB = new SQL.Database(bytes)
  return DB
}

function all(sql, params = []) {
  const stmt = DB.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function one(sql, params = []) {
  return all(sql, params)[0] || null
}

// Mirrors the shapes the components expect (see the backend's schemas).
export const q = {
  listSeries: () =>
    all('SELECT * FROM series ORDER BY COALESCE(title_romaji, title_native, title_english)'),

  getSeries: (id) => one('SELECT * FROM series WHERE id = ?', [id]),

  listBooks: () => all('SELECT * FROM books ORDER BY created_at DESC'),

  getBook: (id) => {
    const b = one('SELECT * FROM books WHERE id = ?', [id])
    if (!b) return null
    b.entries = all('SELECT * FROM entries WHERE book_id = ? ORDER BY order_index', [id]).map(
      (e) => ({
        ...e,
        series: e.series_id ? one('SELECT * FROM series WHERE id = ?', [e.series_id]) : null,
      }),
    )
    return b
  },

  listPages: (bookId) =>
    all(
      'SELECT id, book_id, entry_id, page_number, image_path, panel_count, status ' +
        'FROM pages WHERE book_id = ? ORDER BY page_number',
      [bookId],
    ),

  getPage: (id) => {
    const p = one('SELECT * FROM pages WHERE id = ?', [id])
    if (!p) return null
    p.panels = all('SELECT * FROM panels WHERE page_id = ? ORDER BY panel_index', [id])
    return p
  },

  listGlossary: (seriesId) =>
    all('SELECT * FROM glossary WHERE series_id = ? ORDER BY type, term', [seriesId]),
}
