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
      // Define preload scripts for each window
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/preload/main.js'),
          settings: resolve(__dirname, 'src/preload/settings.js') // Add settings preload
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
      // Define HTML entry points for each window
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/main.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html') // Add settings HTML
        }
      }
    }
  }
})
