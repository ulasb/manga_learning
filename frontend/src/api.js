// Thin fetch wrapper around the backend API.

async function request(path, options = {}) {
  const res = await fetch(path, options)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${res.status}: ${detail}`)
  }
  if (res.status === 204) return null
  return res.json()
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  // search
  search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),

  // series
  listSeries: () => request('/api/series'),
  getSeries: (id) => request(`/api/series/${id}`),
  createSeries: (data) => request('/api/series', json('POST', data)),
  updateSeries: (id, data) => request(`/api/series/${id}`, json('PATCH', data)),
  deleteSeries: (id) => request(`/api/series/${id}`, { method: 'DELETE' }),

  // books
  listBooks: () => request('/api/books'),
  getBook: (id) => request(`/api/books/${id}`),
  createBook: (data) => request('/api/books', json('POST', data)),
  updateBook: (id, data) => request(`/api/books/${id}`, json('PATCH', data)),
  deleteBook: (id) => request(`/api/books/${id}`, { method: 'DELETE' }),

  // entries
  listEntries: (bookId) => request(`/api/books/${bookId}/entries`),
  createEntry: (bookId, data) => request(`/api/books/${bookId}/entries`, json('POST', data)),
  updateEntry: (id, data) => request(`/api/books/entries/${id}`, json('PATCH', data)),
  deleteEntry: (id) => request(`/api/books/entries/${id}`, { method: 'DELETE' }),

  // pages
  listPages: (bookId) => request(`/api/books/${bookId}/pages`),
  getPage: (id) => request(`/api/pages/${id}`),
  updatePage: (id, data) => request(`/api/pages/${id}`, json('PATCH', data)),
  deletePage: (id) => request(`/api/pages/${id}`, { method: 'DELETE' }),
  uploadPage: (bookId, formData) =>
    request(`/api/books/${bookId}/pages`, { method: 'POST', body: formData }),

  // glossary
  listGlossary: (seriesId) => request(`/api/series/${seriesId}/glossary`),
  createTerm: (seriesId, data) => request(`/api/series/${seriesId}/glossary`, json('POST', data)),
  deleteTerm: (id) => request(`/api/glossary/${id}`, { method: 'DELETE' }),
}

// Build an <img src> for a stored image path (e.g. "covers/series-1.jpg").
export const imageUrl = (relPath) => (relPath ? `/images/${relPath}` : null)
