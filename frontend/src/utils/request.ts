import { storage } from './storage'
import config from '../config'

export async function api<T = unknown>(path: string, options: RequestInit = {}) {
	const token = storage.get('token')
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string>),
	}
	if (token) headers['Authorization'] = `Bearer ${token}`
	const base = path.startsWith('/api/') ? '' : config.apiBase
	const res = await fetch(`${base}${path}`, { ...options, headers })
	return res.json() as Promise<T>
}

export async function apiPost<T = unknown>(path: string, body: unknown) {
	return api<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export async function apiGet<T = unknown>(path: string) {
	return api<T>(path, { method: 'GET' })
}
