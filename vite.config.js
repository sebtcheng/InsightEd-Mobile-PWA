import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 👇 CHANGE 1: Switch strategy to injectManifest
      strategies: 'injectManifest',
      // 👇 CHANGE 2: Point to your new source file
      srcDir: 'src',
      filename: 'sw.js',

      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'schools.csv', 'InsightEd1.png'], // Added InsightEd1.png

      manifest: {
        name: 'InsightEd',
        short_name: 'InsightEd',
        description: 'School Data Capture Tool',
        theme_color: '#004A99',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/InsightEd1.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/InsightEd1.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      // Workbox options specific to injectManifest mode
      injectManifest: {
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,csv}'],
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})