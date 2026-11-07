import { defineConfig } from 'vite';
export default defineConfig({
  base: '/IBXStoryMap/',
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'] } } },
  },
});
