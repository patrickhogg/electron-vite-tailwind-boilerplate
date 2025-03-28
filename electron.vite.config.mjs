import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
    // No specific build options needed for main process in basic boilerplate
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Keep only the main preload script
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/preload/main.js')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()],
    build: {
      // Keep only the main renderer entry
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/main.html')
        }
      }
    }
  }
})
