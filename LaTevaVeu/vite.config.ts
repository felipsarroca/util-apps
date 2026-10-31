import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  base: './',
  plugins: [react()],
  // El servidor (npm run server:build) no necessita els fitxers públics del frontend.
  build: { copyPublicDir: !isSsrBuild },
}))
