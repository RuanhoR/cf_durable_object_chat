const DB_NAME = 'hauchat_cache'
const DB_VERSION = 1
const USER_STORE = 'users'

let db: IDBDatabase | null = null

function initDB(): Promise<IDBDatabase> {
	if (db) return Promise.resolve(db)
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION)
		req.onerror = () => reject(req.error)
		req.onsuccess = () => { db = req.result; resolve(db) }
		req.onupgradeneeded = (e) => {
			const d = (e.target as IDBOpenDBRequest).result
			if (!d.objectStoreNames.contains(USER_STORE)) {
				d.createObjectStore(USER_STORE, { keyPath: 'uid' })
			}
		}
	})
}

export interface CachedUser {
	uid: number
	name: string
	cached_at: number
}

export async function getCachedUser(uid: number): Promise<CachedUser | null> {
	const d = await initDB()
	return new Promise((resolve) => {
		const req = d.transaction(USER_STORE, 'readonly').objectStore(USER_STORE).get(uid)
		req.onsuccess = () => {
			const u = req.result as CachedUser
			if (u && Date.now() - u.cached_at < 3600000) resolve(u)
			else resolve(null)
		}
		req.onerror = () => resolve(null)
	})
}

export async function cacheUser(uid: number, name: string) {
	const d = await initDB()
	d.transaction(USER_STORE, 'readwrite').objectStore(USER_STORE).put({ uid, name, cached_at: Date.now() })
}
