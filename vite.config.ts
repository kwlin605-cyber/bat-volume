import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      vitest: path.resolve(__dirname, 'node_modules/vitest'),
    },
  },
  server: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
