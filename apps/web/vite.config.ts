import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
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
      // vitest 会在 __tests__ 下生成临时文件，Windows 上监听到会 EBUSY 崩进程
      ignored: ['**/__tests__/**', '**/dist/**', '**/coverage/**'],
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
