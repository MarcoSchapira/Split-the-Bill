import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3000'
  // The public account-deletion endpoints are new and not on the deployed API yet.
  // Route just those to the local API so the standalone flow works in dev, while
  // everything else keeps using VITE_DEV_API_PROXY_TARGET.
  const deleteAccountApiTarget =
    env.VITE_DEV_DELETE_ACCOUNT_API_TARGET || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/auth/account/': {
          target: deleteAccountApiTarget,
          changeOrigin: true,
          secure: deleteAccountApiTarget.startsWith('https://'),
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: proxyTarget.startsWith('https://'),
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
