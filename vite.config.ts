import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 科技感前端构建配置
// 产物用相对路径 base，便于 nginx 任意子路径托管
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    // 本地开发时把 /api 转发到真实后端，通过 CG_API 指定，例如：
    //   CG_API=https://liufengxi.top npm run dev
    proxy: process.env.CG_API
      ? { '/api': { target: process.env.CG_API, changeOrigin: true, secure: true } }
      : undefined,
  },
})
