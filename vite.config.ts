/// <reference types="vite/client" />
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { defineConfig } from 'vite';

// GitHub Pages base path — set via env var on CI (e.g. "/medimind-angio/")
const base = process.env.VITE_BASE_PATH ?? '/';

/**
 * Read the current git short-hash at build time. Wrapped in try/catch so
 * builds still succeed when git is unavailable (CI worker without .git,
 * downloaded zip, etc.). Uses execFileSync with an explicit args array to
 * avoid any shell interpolation.
 */
function readGitShortHash(): string {
  try {
    const out = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim();
  } catch {
    return 'unknown';
  }
}

const BUILD_HASH = readGitShortHash();

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
  server: {
    port: 3001,
    // Bind to localhost only by default (was: `true`, which exposed the dev
    // server on every network interface). For cross-device testing (mobile
    // on the same LAN), use `npm run dev:lan` or `vite --host` explicitly.
    // See audit-findings/angio-production-audit-2026-04-25.md Part 09 #1.
    host: 'localhost',
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
