import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vitejs.dev/config/
export default defineConfig(() => {
  const isWeb = process.env.WEB_BUILD === 'true'
  
  return {
    base: './',
    plugins: [
      react(),
      ...(!isWeb ? [
        electron([
          {
            entry: 'electron/main.js',
          },
        ]),
        renderer(),
      ] : [])
    ],
  }
})
