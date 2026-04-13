import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { reinspectAutoDiscoverPlugin } from './src/plugin/reinspectAutoDiscoverPlugin'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // Keep auto-discovery imports and local sample imports on the same module instance.
      'react-reinspect': path.resolve(__dirname, 'src/reinspect/index.ts'),
    },
  },
  plugins: [reinspectAutoDiscoverPlugin(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
