import { createApp } from 'vue'
import Settings from './Settings.vue'
import './assets/base.css' // Corrected path: Import Tailwind base styles

/* import the fontawesome core */
import { library } from '@fortawesome/fontawesome-svg-core'

/* import font awesome icon component */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/* import specific icons (add any needed for settings specifically) */
// import { faSomeIcon } from '@fortawesome/free-solid-svg-icons'

/* add icons to the library */
// library.add(faSomeIcon)

const app = createApp(Settings)

app.component('font-awesome-icon', FontAwesomeIcon) // Register component globally

app.mount('#app')
