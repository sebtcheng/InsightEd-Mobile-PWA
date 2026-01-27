import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true, // <--- Key fix for "Prompt Not Available"
        type: 'module',
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'InsightEd1.png'],
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
            sizes: '192x192', // Ensure your file is high res enough
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/InsightEd1.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,csv}'],
        maximumFileSizeToCacheInBytes: 120 * 1024 * 1024, // 120MB
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})