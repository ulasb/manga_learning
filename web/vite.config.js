import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages under the repo name (project pages):
//   https://ulasb.github.io/manga_learning/
// Override with BASE=/ for a root user-site deploy.
export default defineConfig({
  base: process.env.BASE || '/manga_learning/',
  plugins: [react()],
})
