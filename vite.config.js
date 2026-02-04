import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/insighted/', // Ensure the slashes are there
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: null, // <--- Disable auto injection to use manual registration in Context
      manifestFilename: 'manifest.json', // Set the output filename
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'InsightEd1.png'],
      manifest: {
        name: 'InsightEd',
        short_name: 'InsightEd',
        description: 'School Data Capture Tool',
        theme_color: '#004A99',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'InsightED app.png', // Relative path
            sizes: '192x192', // Ensure your file is high res enough
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'InsightED app.png', // Relative path
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