import { createRouter, createWebHistory } from 'vue-router'
import ChatApp from '../components/ChatApp.vue'
import CallbackView from '../components/CallbackView.vue'
import LoginRedirect from '../components/LoginRedirect.vue'

const routes = [
	{
		path: '/',
		component: ChatApp,
	},
	{
		path: '/_callback',
		component: CallbackView,
	},
	{
		path: '/login',
		component: LoginRedirect,
	},
]

export const router = createRouter({
	routes,
	history: createWebHistory(),
})
