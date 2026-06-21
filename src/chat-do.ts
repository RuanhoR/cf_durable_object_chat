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
	description: string
	created_at: string
	updated_at: string
	created_by: number
	owner_id: number
}

interface RoomMember {
	room_id: number
	user_id: number
	role: string
	muted_until: string | null
	joined_at: string
}

export class ChatRoomDO extends DurableObject {
	sql = this.ctx.storage.sql
	connections = new Map<number, Set<WebSocket>>()

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS rooms (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now')),
				created_by INTEGER NOT NULL,
				owner_id INTEGER NOT NULL
			)
		`)
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS room_members (
				room_id INTEGER NOT NULL,
				user_id INTEGER NOT NULL,
				role TEXT NOT NULL DEFAULT 'member',
				muted_until TEXT,
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
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS private_rooms (
				room_id INTEGER NOT NULL,
				user_a INTEGER NOT NULL,
				user_b INTEGER NOT NULL,
				PRIMARY KEY (room_id)
			)
		`)
		try { this.sql.exec("ALTER TABLE rooms ADD COLUMN description TEXT NOT NULL DEFAULT ''") } catch {}
		try { this.sql.exec('ALTER TABLE rooms ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime(\'now\'))') } catch {}
		try { this.sql.exec('ALTER TABLE rooms ADD COLUMN owner_id INTEGER NOT NULL DEFAULT 0') } catch {}
		try { this.sql.exec("ALTER TABLE room_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'") } catch {}
		try { this.sql.exec('ALTER TABLE room_members ADD COLUMN muted_until TEXT') } catch {}
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS user_index (
				user_id INTEGER PRIMARY KEY,
				user_name TEXT NOT NULL
			)
		`)
	}

	async fetch(request: Request) {
		const url = new URL(request.url)
		const roomId = parseInt(url.searchParams.get('room_id') || '')
		void url.searchParams.get('user_id')
		if (!roomId) return new Response('room_id required', { status: 400 })

		const pair = new WebSocketPair()
		const [client, server] = [pair[0], pair[1]]

		server.accept()
		if (!this.connections.has(roomId)) {
			this.connections.set(roomId, new Set())
		}
		this.connections.get(roomId)!.add(server)

		server.addEventListener('close', () => {
			this.connections.get(roomId)?.delete(server)
		})
		server.addEventListener('error', () => {
			this.connections.get(roomId)?.delete(server)
		})

		return new Response(null, { status: 101, webSocket: client })
	}

	private broadcast(roomId: number, data: unknown) {
		const conns = this.connections.get(roomId)
		if (!conns) return
		const msg = JSON.stringify(data)
		for (const ws of conns) {
			try { ws.send(msg) } catch { conns.delete(ws) }
		}
	}

	createRoom(name: string, userId: number): ChatRoom {
		this.sql.exec('INSERT INTO rooms (name, created_by, owner_id) VALUES (?, ?, ?)', name, userId, userId)
		const room = this.sql.exec('SELECT * FROM rooms WHERE id = last_insert_rowid()').one() as unknown as ChatRoom
		this.sql.exec('INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)', room.id, userId, 'owner')
		return room
	}

	listRooms(): ChatRoom[] {
		return this.sql.exec('SELECT * FROM rooms WHERE description != \'__private__\' ORDER BY created_at DESC').toArray() as unknown as ChatRoom[]
	}

	joinRoom(roomId: number, userId: number): boolean {
		const existing = this.sql.exec('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?', roomId, userId).one()
		if (existing) return false
		this.sql.exec("INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, 'member')", roomId, userId)
		this.broadcast(roomId, { type: 'member_joined', user_id: userId })
		return true
	}

	leaveRoom(roomId: number, userId: number): void {
		this.sql.exec('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', roomId, userId)
	}

	getUserRooms(userId: number): ChatRoom[] {
		return this.sql.exec(`
			SELECT r.* FROM rooms r
			INNER JOIN room_members rm ON r.id = rm.room_id
			WHERE rm.user_id = ? AND r.description != '__private__'
			ORDER BY r.created_at DESC
		`, userId).toArray() as unknown as ChatRoom[]
	}

	private indexUser(userId: number, userName: string) {
		this.sql.exec('INSERT OR REPLACE INTO user_index (user_id, user_name) VALUES (?, ?)', userId, userName)
	}

	sendMessage(roomId: number, userId: number, userName: string, content: string): ChatMessage | null {
		const isMuted = this.sql.exec(
			"SELECT muted_until FROM room_members WHERE room_id = ? AND user_id = ? AND muted_until > datetime('now')",
			roomId, userId
		).one()
		if (isMuted) return null
		this.indexUser(userId, userName)
		this.sql.exec(
			'INSERT INTO messages (room_id, user_id, user_name, content) VALUES (?, ?, ?, ?)',
			roomId, userId, userName, content
		)
		const msg = this.sql.exec('SELECT * FROM messages WHERE id = last_insert_rowid()').one() as unknown as ChatMessage
		this.broadcast(roomId, { type: 'new_message', message: msg })
		return msg
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

	getRoomMembers(roomId: number): RoomMember[] {
		return this.sql.exec(
			'SELECT * FROM room_members WHERE room_id = ? ORDER BY joined_at ASC',
			roomId
		).toArray() as unknown as RoomMember[]
	}

	getMemberRole(roomId: number, userId: number): string | null {
		const row = this.sql.exec(
			'SELECT role FROM room_members WHERE room_id = ? AND user_id = ?',
			roomId, userId
		).one() as { role: string } | undefined
		return row ? row.role : null
	}

	setMemberRole(roomId: number, userId: number, role: string): void {
		this.sql.exec('UPDATE room_members SET role = ? WHERE room_id = ? AND user_id = ?', role, roomId, userId)
		this.broadcast(roomId, { type: 'role_updated', user_id: userId, role })
	}

	muteMember(roomId: number, userId: number, until: string): void {
		this.sql.exec('UPDATE room_members SET muted_until = ? WHERE room_id = ? AND user_id = ?', until, roomId, userId)
	}

	unmuteMember(roomId: number, userId: number): void {
		this.sql.exec('UPDATE room_members SET muted_until = NULL WHERE room_id = ? AND user_id = ?', roomId, userId)
	}

	updateRoom(roomId: number, name: string, description: string): void {
		this.sql.exec(
			"UPDATE rooms SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
			name, description, roomId
		)
	}

	dissolveRoom(roomId: number): void {
		this.sql.exec('DELETE FROM messages WHERE room_id = ?', roomId)
		this.sql.exec('DELETE FROM room_members WHERE room_id = ?', roomId)
		this.sql.exec('DELETE FROM private_rooms WHERE room_id = ?', roomId)
		this.sql.exec('DELETE FROM rooms WHERE id = ?', roomId)
		const conns = this.connections.get(roomId)
		if (conns) {
			for (const ws of conns) {
				try { ws.close(1000, 'room dissolved') } catch {}
			}
			this.connections.delete(roomId)
		}
	}

	createPrivateRoom(userA: number, userB: number): ChatRoom {
		const existing = this.sql.exec(`
			SELECT r.* FROM rooms r
			INNER JOIN private_rooms p ON r.id = p.room_id
			WHERE (p.user_a = ? AND p.user_b = ?) OR (p.user_a = ? AND p.user_b = ?)
			LIMIT 1
		`, userA, userB, userB, userA).one() as unknown as ChatRoom | undefined
		if (existing) return existing

		this.sql.exec("INSERT INTO rooms (name, description, created_by, owner_id) VALUES (?, '__private__', ?, ?)",
			'private', userA, userA)
		const room = this.sql.exec('SELECT * FROM rooms WHERE id = last_insert_rowid()').one() as unknown as ChatRoom
		this.sql.exec('INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)', room.id, userA, 'member')
		this.sql.exec('INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)', room.id, userB, 'member')
		this.sql.exec('INSERT INTO private_rooms (room_id, user_a, user_b) VALUES (?, ?, ?)', room.id, userA, userB)
		return room
	}

	getPrivateRooms(userId: number): ChatRoom[] {
		return this.sql.exec(`
			SELECT r.* FROM rooms r
			INNER JOIN private_rooms p ON r.id = p.room_id
			WHERE (p.user_a = ? OR p.user_b = ?) AND r.description = '__private__'
			ORDER BY r.updated_at DESC
		`, userId, userId).toArray() as unknown as ChatRoom[]
	}

	getPrivatePeer(roomId: number, userId: number): number | null {
		const row = this.sql.exec(
			'SELECT user_a, user_b FROM private_rooms WHERE room_id = ?',
			roomId
		).one() as { user_a: number; user_b: number } | undefined
		if (!row) return null
		return row.user_a === userId ? row.user_b : row.user_a
	}

	getRoomById(roomId: number): ChatRoom | null {
		const row = this.sql.exec('SELECT * FROM rooms WHERE id = ?', roomId).one() as unknown as ChatRoom | undefined
		return row || null
	}

	getUserProfile(userId: number): { uid: number; name: string } | null {
		const user = this.sql.exec(
			'SELECT user_id as uid, user_name as name FROM user_index WHERE user_id = ?',
			userId
		).one() as { uid: number; name: string } | undefined
		return user || null
	}

	searchRooms(query: string): ChatRoom[] {
		return this.sql.exec(
			"SELECT * FROM rooms WHERE description != '__private__' AND name LIKE ? ORDER BY created_at DESC LIMIT 20",
			`%${query}%`
		).toArray() as unknown as ChatRoom[]
	}

	searchUsers(query: string): { uid: number; name: string }[] {
		return this.sql.exec(
			'SELECT user_id as uid, user_name as name FROM user_index WHERE user_name LIKE ? ORDER BY user_name ASC LIMIT 20',
			`%${query}%`
		).toArray() as { uid: number; name: string }[]
	}
}
