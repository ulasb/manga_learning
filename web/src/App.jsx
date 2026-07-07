import { NavLink, Route, Routes } from 'react-router-dom'
import { useData } from './DataContext.jsx'
import Library from './pages/Library.jsx'
import SeriesDetail from './pages/SeriesDetail.jsx'
import BookDetail from './pages/BookDetail.jsx'
import Reader from './pages/Reader.jsx'

export default function App() {
  const { forget } = useData()
  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          漫画 <span>Reader</span>
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Library
          </NavLink>
        </nav>
        <div className="spacer" />
        <button className="ghost" onClick={forget} title="Switch to a different data folder">
          change folder
        </button>
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
