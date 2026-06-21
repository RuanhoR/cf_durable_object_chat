import { DurableObject } from 'cloudflare:workers'

interface ChatMessage {
	id: number
	room_id: number
	user_id: number
	user_name: string
	content: string
	created_at: string
}

interface ChatRoom {
	id: number
	name: string
	created_at: string
	created_by: number
}

export class ChatRoomDO extends DurableObject {
	sql = this.ctx.storage.sql

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS rooms (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				created_by INTEGER NOT NULL
			)
		`)
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS room_members (
				room_id INTEGER NOT NULL,
				user_id INTEGER NOT NULL,
				joined_at TEXT NOT NULL DEFAULT (datetime('now')),
				PRIMARY KEY (room_id, user_id)
			)
		`)
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				room_id INTEGER NOT NULL,
				user_id INTEGER NOT NULL,
				user_name TEXT NOT NULL,
				content TEXT NOT NULL,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`)
	}

	createRoom(name: string, userId: number): ChatRoom {
		this.sql.exec('INSERT INTO rooms (name, created_by) VALUES (?, ?)', name, userId)
		const room = this.sql.exec('SELECT * FROM rooms WHERE id = last_insert_rowid()').one() as unknown as ChatRoom
		this.sql.exec('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)', room.id, userId)
		return room
	}

	listRooms(): ChatRoom[] {
		return this.sql.exec('SELECT * FROM rooms ORDER BY created_at DESC').toArray() as unknown as ChatRoom[]
	}

	joinRoom(roomId: number, userId: number): boolean {
		const existing = this.sql.exec('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?', roomId, userId).one()
		if (existing) return false
		this.sql.exec('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)', roomId, userId)
		return true
	}

	leaveRoom(roomId: number, userId: number): void {
		this.sql.exec('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', roomId, userId)
	}

	getUserRooms(userId: number): ChatRoom[] {
		return this.sql.exec(`
			SELECT r.* FROM rooms r
			INNER JOIN room_members rm ON r.id = rm.room_id
			WHERE rm.user_id = ?
			ORDER BY r.created_at DESC
		`, userId).toArray() as unknown as ChatRoom[]
	}

	sendMessage(roomId: number, userId: number, userName: string, content: string): ChatMessage {
		this.sql.exec(
			'INSERT INTO messages (room_id, user_id, user_name, content) VALUES (?, ?, ?, ?)',
			roomId, userId, userName, content
		)
		return this.sql.exec('SELECT * FROM messages WHERE id = last_insert_rowid()').one() as unknown as ChatMessage
	}

	getMessages(roomId: number, limit = 50): ChatMessage[] {
		return this.sql.exec(
			'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?',
			roomId, limit
		).toArray() as unknown as ChatMessage[]
	}

	isRoomMember(roomId: number, userId: number): boolean {
		const row = this.sql.exec('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?', roomId, userId).one()
		return !!row
	}
}
