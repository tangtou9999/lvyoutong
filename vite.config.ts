import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves this project under /lvyoutong/, not the domain root.
  base: '/lvyoutong/',
  plugins: [react()],
})
