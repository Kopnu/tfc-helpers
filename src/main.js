import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import './styles/base.css'
import './styles/app.css'
import './styles/shared.css'
import './styles/alloy.css'
import './styles/ironworking.css'
import './styles/prospector.css'

createApp(App).use(i18n).mount('#app')
