import { ref, type Ref } from 'vue'
import { storage } from './storage'
import { apiGet, apiPost } from './request'

const user: Ref<{ uid: number; name: string } | null> = ref(null)
const isLogin = ref(false)
const isLoading = ref(true)

export function useLogin() {
	return { user, isLogin, isLoading }
}

export async function checkLogin() {
	const token = storage.get('token')
	if (!token) {
		isLoading.value = false
		return false
	}
	try {
		const data: any = await apiGet('/api/user/info')
		if (data?.code === 200 && data.data?.user) {
			user.value = data.data.user
			isLogin.value = true
			isLoading.value = false
			return true
		}
	} catch {}
	storage.rm('token')
	user.value = null
	isLogin.value = false
	isLoading.value = false
	return false
}

export function setToken(token: string) {
	storage.set('token', token)
}

export function goLogin(redirectPath?: string) {
	const path = redirectPath || window.location.pathname + window.location.search
	localStorage.setItem('login_redirect', path)
	const loginUrl = `https://account.ruanhor.dpdns.org/oauth2?response_type=code&client_id=ZDRmNjU4ZDEvIlswZDhkMGM5MS01Mzc1LTQ0MmUtOTg3Yi0xMGJlMjBiNmNiMjM=&redirect_uri=${encodeURIComponent('https://hauchat.wei.qzz.io/_callback')}`
	window.location.href = loginUrl
}

export function getLoginRedirect(): string {
	return localStorage.getItem('login_redirect') || '/'
}

export function clearLoginRedirect() {
	localStorage.removeItem('login_redirect')
}

export async function logout() {
	const token = storage.get('token')
	if (token) {
		try {
			await apiPost('/api/auth/logout', {})
		} catch {}
	}
	storage.rm('token')
	user.value = null
	isLogin.value = false
}
