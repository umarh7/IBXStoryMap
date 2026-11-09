import { defineConfig } from 'vite';
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/IBXStoryMap/' : '/',
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) { if (id.includes('node_modules/maplibre-gl')) return 'maplibre'; },
      },
    },
  },
}));
