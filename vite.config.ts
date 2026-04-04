import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const normalizeId = (id: string) => id.replaceAll('\\', '/')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'echarts-for-react/lib/core',
      'echarts/core',
      'echarts/charts',
      'echarts/components',
      'echarts/features',
      'echarts/renderers',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = normalizeId(id)

          if (!normalizedId.includes('/node_modules/')) {
            return
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }

          if (normalizedId.includes('/node_modules/fabric/')) {
            return 'vendor-canvas'
          }

          if (
            normalizedId.includes('/node_modules/echarts/') ||
            normalizedId.includes('/node_modules/echarts-for-react/') ||
            normalizedId.includes('/node_modules/zrender/')
          ) {
            return 'vendor-charts'
          }
        },
      },
    },
  },
})
