import zh from './zh.json'
import en from './en.json'
import type { Language } from '../types'

const langs: Record<string, Language> = { zh: zh as Language, en: en as Language }

let current = localStorage.getItem('hauchat_lang') || navigator.language.split('-')[0]
if (!langs[current]) current = 'en'

export function t(key: keyof Language): string {
	return langs[current][key] || langs['en'][key] || key
}

export function setLang(lang: string) {
	if (langs[lang]) {
		current = lang
		localStorage.setItem('hauchat_lang', lang)
	}
}

export function getLang(): string {
	return current
}
