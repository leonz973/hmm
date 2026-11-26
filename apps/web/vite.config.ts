import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'HMM 家庭资产管家',
        short_name: 'HMM',
        description: '把家当记清楚、管明白、换得从容',
        lang: 'zh-CN',
        theme_color: '#059669',
        background_color: '#f6f8f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // 不要把接口请求吞进 SW 缓存
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@hmm/shared': fileURLToPath(new URL('../../packages/shared/src/main.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // vitest 临时文件、以及编辑器/工具原子写入产生的 .xxx.tmpdir 目录，
      // Windows 上被监听会 EBUSY 直接崩掉 dev server
      ignored: [/\.tmpdir/, /__tests__/, '**/dist/**', '**/coverage/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
