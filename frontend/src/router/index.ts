import { createRouter, createWebHistory } from 'vue-router'
import ChatApp from '../components/ChatApp.vue'
import CallbackView from '../components/CallbackView.vue'

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
		redirect() {
			const loginUrl = `https://account.ruanhor.dpdns.org/oauth2?response_type=code&client_id=ZDRmNjU4ZDEvIlswZDhkMGM5MS01Mzc1LTQ0MmUtOTg3Yi0xMGJlMjBiNmNiMjM=&redirect_uri=${encodeURIComponent('https://hauchat.wei.qzz.io/_callback')}`
			window.location.href = loginUrl
			return '/'
		},
	},
]

export const router = createRouter({
	routes,
	history: createWebHistory(),
})
