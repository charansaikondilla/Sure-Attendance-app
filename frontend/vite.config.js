import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '')
  // Extract deployment path from VITE_API_URL
  let deploymentPath = ''
  try {
    const url = new URL(env.VITE_API_URL)
    deploymentPath = url.pathname
  } catch (e) {
    console.error('Invalid VITE_API_URL in .env:', env.VITE_API_URL)
  }
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'https://script.google.com',
          changeOrigin: true,
          rewrite: (p) => deploymentPath + (p.replace(/^\/api/, '')),
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.error('❌ Proxy Error:', err.message);
            });
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('📤 API Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              const status = proxyRes.statusCode;
              const emoji = status >= 200 && status < 300 ? '✅' : '❌';
              console.log(`${emoji} API Response: ${status} - ${req.method} ${req.url}`);
            });
          },
        }
      }
    }
  }
})
