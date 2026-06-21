import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const theme = localStorage.getItem('hauchat_theme')
if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')

createApp(App).mount('#app')
