import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/global.css'
import { applyStoredTheme } from './composables/useTheme'

applyStoredTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
