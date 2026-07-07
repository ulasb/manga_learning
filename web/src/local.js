// Local data-folder access via the File System Access API.
// The user picks their backend/data folder once; we persist the directory
// handle in IndexedDB so Chromium browsers can re-open it on later visits.
// Nothing here ever leaves the machine.

const IDB_NAME = 'manga-reader'
const STORE = 'handles'
const KEY = 'dataDir'

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveHandle(handle) {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(handle, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadHandle() {
  const db = await idb()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const rq = tx.objectStore(STORE).get(KEY)
    rq.onsuccess = () => resolve(rq.result || null)
    rq.onerror = () => resolve(null)
  })
}

export async function clearHandle() {
  const db = await idb()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

export function supportsFsAccess() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function pickDir() {
  const handle = await window.showDirectoryPicker({ id: 'manga-data', mode: 'read' })
  await saveHandle(handle)
  return handle
}

// 'granted' | 'prompt' | 'denied'
export async function permissionState(handle) {
  if (!handle.queryPermission) return 'granted'
  return handle.queryPermission({ mode: 'read' })
}

export async function requestPermission(handle) {
  if (!handle.requestPermission) return true
  return (await handle.requestPermission({ mode: 'read' })) === 'granted'
}

async function resolveFile(root, path) {
  const parts = path.split('/').filter(Boolean)
  let dir = root
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i])
  }
  return dir.getFileHandle(parts[parts.length - 1])
}

export async function readBytes(root, path) {
  const fh = await resolveFile(root, path)
  const file = await fh.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

// Cache object URLs so each image is read from disk only once.
const urlCache = new Map()

export async function objectURL(root, path) {
  if (urlCache.has(path)) return urlCache.get(path)
  try {
    const fh = await resolveFile(root, path)
    const file = await fh.getFile()
    const url = URL.createObjectURL(file)
    urlCache.set(path, url)
    return url
  } catch {
    return null
  }
}
