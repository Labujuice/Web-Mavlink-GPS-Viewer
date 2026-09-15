import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相對路徑支援，方便部署在任意靜態子路徑 (如 GitHub Pages /repo-name/)
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['echarts'],
          map: ['leaflet'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
