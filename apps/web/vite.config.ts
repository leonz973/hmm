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
