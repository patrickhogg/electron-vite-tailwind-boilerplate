import { createApp } from 'vue'
import App from './Main.vue'
import './assets/base.css' // Import Tailwind base styles

/* import the fontawesome core */
import { library } from '@fortawesome/fontawesome-svg-core'

/* import font awesome icon component */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/* import specific icons */
import { faGear, faPhone, faPhoneSlash } from '@fortawesome/free-solid-svg-icons'

/* add icons to the library */
library.add(faGear, faPhone, faPhoneSlash)

const app = createApp(App)

app.component('font-awesome-icon', FontAwesomeIcon) // Register component globally

app.mount('#app')
