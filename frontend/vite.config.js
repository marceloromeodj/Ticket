import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api':     { target: 'http://localhost:3001', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
      '/socket.io': { target: 'http://localhost:3001', ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir:         'dist',
    // Vite pone sus JS/CSS compilados acá por defecto en "assets/", lo que
    // choca con la ruta de la app /assets (Activos/CMDB): al entrar por URL
    // directa, nginx encuentra esa carpeta física sin index.html y devuelve
    // 403 en vez de servir la SPA. Se renombra para que no colisionen.
    assetsDir:      'static',
    sourcemap:      false,
    chunkSizeWarningLimit: 1000,
  },
});
