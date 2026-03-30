import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, proxy /api/niagara/* to your Niagara via Cloudflare Tunnel
      '/api/niagara': {
        target: 'https://crowd-navigation-custody-riding.trycloudflare.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/niagara/, '/snls/api'),
        headers: {
          'Authorization': 'Basic ' + Buffer.from('API:Alser12345').toString('base64'),
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    }
  }
})
