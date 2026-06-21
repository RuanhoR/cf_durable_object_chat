const keys = {
	token: '__chat_token',
	theme: '__chat_theme',
} as const

export const storage = {
	set(key: keyof typeof keys, value: string) {
		localStorage.setItem(keys[key], value)
	},
	get(key: keyof typeof keys) {
		return localStorage.getItem(keys[key])
	},
	rm(key: keyof typeof keys) {
		localStorage.removeItem(keys[key])
	},
}
