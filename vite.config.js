import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/niagara': {
        target: 'https://crowd-navigation-custody-riding.trycloudflare.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          // /api/niagara?path=equipment/piso4 → /snls/api/equipment/piso4
          const url = new URL(path, 'http://localhost');
          const apiPath = url.searchParams.get('path') || 'config';
          return '/snls/api/' + apiPath;
        },
        headers: {
          'Authorization': 'Basic ' + Buffer.from('API:Alser12345').toString('base64'),
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    }
  }
})
