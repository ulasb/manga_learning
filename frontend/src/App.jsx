import { NavLink, Route, Routes } from 'react-router-dom'
import Library from './pages/Library.jsx'
import SeriesDetail from './pages/SeriesDetail.jsx'
import BookDetail from './pages/BookDetail.jsx'
import Reader from './pages/Reader.jsx'

export default function App() {
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          漫画 <span>Learning</span>
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Library
          </NavLink>
        </nav>
        <div className="spacer" />
      </header>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/series/:id" element={<SeriesDetail />} />
        <Route path="/books/:id" element={<BookDetail />} />
        <Route path="/read/:bookId" element={<Reader />} />
        <Route path="/read/:bookId/:pageId" element={<Reader />} />
      </Routes>
    </>
  )
}
