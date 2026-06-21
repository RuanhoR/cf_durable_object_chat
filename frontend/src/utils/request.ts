import { storage } from './storage'

export async function api(path: string, options: RequestInit = {}) {
	const token = storage.get('token')
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string>),
	}
	if (token) headers['Authorization'] = `Bearer ${token}`
	const res = await fetch(path, { ...options, headers })
	return res.json()
}

export async function apiPost(path: string, body: unknown) {
	return api(path, { method: 'POST', body: JSON.stringify(body) })
}

export async function apiGet(path: string) {
	return api(path, { method: 'GET' })
}
