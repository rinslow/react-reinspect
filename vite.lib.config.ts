import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/reinspect/index.ts'),
        'internal/auto-wrap': path.resolve(
          __dirname,
          'src/reinspect/internal/auto-wrap.ts',
        ),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const extension = format === 'es' ? 'js' : 'cjs'
        if (entryName === 'index') {
          return `index.${extension}`
        }

        return `${entryName}.${extension}`
      },
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
})
