import { ref, type Ref } from 'vue'
import { storage } from './storage'
import { apiGet } from './request'
import type { User } from '../types'

const user: Ref<User | null> = ref(null)
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
		if (data.user) {
			user.value = data.user
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

export function logout() {
	storage.rm('token')
	user.value = null
	isLogin.value = false
}
