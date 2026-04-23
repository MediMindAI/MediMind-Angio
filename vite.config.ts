/// <reference types="vite/client" />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

// GitHub Pages base path — set via env var on CI (e.g. "/medimind-angio/")
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001,
    host: true,
  },
  preview: {
    port: 3001,
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/@mantine/')) return 'mantine';
          if (id.includes('node_modules/@react-pdf/')) return 'pdf';
          if (id.includes('node_modules/@tabler/icons-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@mantine/core', '@mantine/dates', '@mantine/hooks', '@mantine/form'],
  },
  // Raw SVG imports for anatomy assets
  assetsInclude: ['**/*.svg'],
});
