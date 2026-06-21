const DB_NAME = 'hauchat_cache'
const DB_VERSION = 2
const USER_STORE = 'users'
const MESSAGE_STORE = 'messages'

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
			if (!d.objectStoreNames.contains(MESSAGE_STORE)) {
				const msgStore = d.createObjectStore(MESSAGE_STORE, { keyPath: 'id' })
				msgStore.createIndex('room_id', 'room_id', { unique: false })
			}
		}
	})
}

export interface CachedUser {
	uid: number
	name: string
	cached_at: number
}

export interface CachedMessage {
	id: number
	room_id: number
	user_id: number
	user_name: string
	content: string
	created_at: string
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

export async function getCachedMessages(roomId: number, limit = 50): Promise<CachedMessage[]> {
	const d = await initDB()
	return new Promise((resolve) => {
		const store = d.transaction(MESSAGE_STORE, 'readonly').objectStore(MESSAGE_STORE)
		const index = store.index('room_id')
		const req = index.getAll(roomId)
		req.onsuccess = () => {
			const msgs = req.result as CachedMessage[]
			msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
			resolve(msgs.slice(-limit))
		}
		req.onerror = () => resolve([])
	})
}

export async function cacheMessages(messages: CachedMessage[]) {
	if (!messages.length) return
	const d = await initDB()
	const store = d.transaction(MESSAGE_STORE, 'readwrite').objectStore(MESSAGE_STORE)
	for (const msg of messages) {
		store.put(msg)
	}
}

export async function cacheMessage(msg: CachedMessage) {
	const d = await initDB()
	d.transaction(MESSAGE_STORE, 'readwrite').objectStore(MESSAGE_STORE).put(msg)
}