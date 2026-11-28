import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Saffilion/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'fonts/*.ttf', 'fonts/OFL.txt'],
      manifest: {
        name: 'Saffilion — Cozy Rarity Mining',
        short_name: 'Saffilion',
        id: '/Saffilion/',
        description: 'Dig deeper with rarer trivia answers.',
        theme_color: '#392846',
        background_color: '#f9ecd7',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['games', 'education', 'entertainment'],
        prefer_related_applications: false,
        scope: '/Saffilion/',
        start_url: '/Saffilion/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,ttf,txt}'],
        // The entity registry is compiled into the main application chunk. Keep the
        // explicit ceiling comfortably above that measured asset while the public
        // knowledge shards remain below 250 KiB each.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: { environment: 'node', globals: true, include: ['src/**/*.test.ts'] }
});
