import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'canvas-vendor',
              test: /[\\/]node_modules[\\/](konva|react-konva|react-reconciler|its-fine)[\\/]/,
            },
            {
              name: 'collaboration-vendor',
              test: /[\\/]node_modules[\\/](yjs|y-webrtc|y-protocols|lib0|simple-peer)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
