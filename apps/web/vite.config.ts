import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 4311,
    proxy: {
      '/api': 'http://127.0.0.1:4310',
      '/health': 'http://127.0.0.1:4310',
    },
  },
  preview: { host: '127.0.0.1', port: 4311 },
});
