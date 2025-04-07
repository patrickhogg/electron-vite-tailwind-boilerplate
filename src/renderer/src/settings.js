import { createApp } from 'vue'
import Settings from './Settings.vue'
import './assets/base.css' // Corrected path: Import Tailwind base styles

const app = createApp(Settings)

app.mount('#app')
