import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// De React-frontend leeft in client/ en wordt gebouwd naar dist/client/,
// die de Express-server statisch serveert. In dev draait Vite op poort 5173
// en proxiet /api naar de Express-server op 3000.
export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
