import { useEffect, useState } from 'react'
import { useData } from '../DataContext.jsx'

// Resolves a stored image path (e.g. "covers/series-1.jpg") to a local object
// URL, asynchronously, from the picked data folder.
export default function LocalImage({ path, className, alt = '', fallback }) {
  const { resolveImage } = useData()
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let active = true
    setSrc(null)
    resolveImage(path).then((u) => active && setSrc(u))
    return () => {
      active = false
    }
  }, [path])

  if (src) return <img className={className} src={src} alt={alt} />
  return <div className={`${className || ''} placeholder`}>{fallback || ''}</div>
}
