import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturesRoot = path.join(repoRoot, 'modelsfortests')

/**
 * F-057 / STEP-26 residual: the federation sample loader fetches
 * `/modelsfortests/<fixture>` at runtime, but Vite serves `frontend/public`, not the repo
 * root, so that request 404'd. These fixtures are deliberately untracked (local-only), so
 * this serves them in dev without pretending they exist in a production build.
 */
function serveModelFixtures(): Plugin {
  return {
    name: 'serve-modelsfortests',
    configureServer(server) {
      server.middlewares.use('/modelsfortests', (req, res) => {
        const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const file = path.resolve(fixturesRoot, rel)
        const contained = file === fixturesRoot || file.startsWith(fixturesRoot + path.sep)
        if (!rel || !contained || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(`Fixture not found. Place ${rel || 'the IFC fixture'} in modelsfortests/.`)
          return
        }
        res.setHeader('Content-Type', 'application/octet-stream')
        fs.createReadStream(file).pipe(res)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    serveModelFixtures(),
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true
      }
    }
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['web-ifc']
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@xeokit')) {
            return 'xeokit-engine';
          }
          if (id.includes('three') || id.includes('three-mesh-bvh')) {
            return 'three-core';
          }
          if (id.includes('lucide-react')) {
            return 'ui-icons';
          }
          if (id.includes('@radix-ui')) {
            return 'ui-radix';
          }
        }
      }
    }
  }
})
