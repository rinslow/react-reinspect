import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { reinspectAutoDiscoverPlugin } from './reinspectAutoDiscoverPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [reinspectAutoDiscoverPlugin(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
