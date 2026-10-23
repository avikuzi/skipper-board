import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset paths relative, so the build runs from any folder or host.
export default defineConfig({
  plugins: [react()],
  base: './',
})
