import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const target = env.VITE_SUPABASE_URL || 'https://kqjyubxrbjyvakpvcymc.supabase.co'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/supabase': {
          target,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/supabase/, ''),
        },
      },
    },
  }
})

