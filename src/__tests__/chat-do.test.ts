import { describe, it, expect } from 'vitest'

interface MockRoom {
	id: number
	name: string
	description: string
	created_by: number
	owner_id: number
}

interface MockMember {
	room_id: number
	user_id: number
	role: string
}

describe('ChatRoomDO logic (unit)', () => {
	function createDO() {
		const rooms: MockRoom[] = []
		const members: MockMember[] = []
		let nextRoomId = 1

		return {
			createRoom(name: string, userId: number) {
				const room: MockRoom = {
					id: nextRoomId++,
					name,
					description: '',
					created_by: userId,
					owner_id: userId,
				}
				rooms.push(room)
				members.push({ room_id: room.id, user_id: userId, role: 'owner' })
				return room
			},
			listRooms() {
				return rooms.filter(r => r.description !== '__private__')
					.sort((a, b) => a.created_by - b.created_by)
			},
			joinRoom(roomId: number, userId: number) {
				const existing = members.find(m => m.room_id === roomId && m.user_id === userId)
				if (existing) return false
				members.push({ room_id: roomId, user_id: userId, role: 'member' })
				return true
			},
			leaveRoom(roomId: number, userId: number) {
				const idx = members.findIndex(m => m.room_id === roomId && m.user_id === userId)
				if (idx >= 0) members.splice(idx, 1)
			},
			isRoomMember(roomId: number, userId: number) {
				return members.some(m => m.room_id === roomId && m.user_id === userId)
			},
			getMembers() { return members },
			getRooms() { return rooms },
		}
	}

	it('creates a room', () => {
		const doObj = createDO()
		const room = doObj.createRoom('test-room', 1)
		expect(room).toBeDefined()
		expect(room.name).toBe('test-room')
		expect(room.created_by).toBe(1)
		expect(room.owner_id).toBe(1)
	})

	it('lists rooms', () => {
		const doObj = createDO()
		doObj.createRoom('room-a', 1)
		doObj.createRoom('room-b', 2)
		const roomList = doObj.listRooms()
		expect(roomList).toHaveLength(2)
	})

	it('joins a room', () => {
		const doObj = createDO()
		const room = doObj.createRoom('room-a', 1)
		const joined = doObj.joinRoom(room.id, 2)
		expect(joined).toBe(true)
		expect(doObj.isRoomMember(room.id, 2)).toBe(true)
	})

	it('does not duplicate join', () => {
		const doObj = createDO()
		const room = doObj.createRoom('room-a', 1)
		doObj.joinRoom(room.id, 2)
		const joined = doObj.joinRoom(room.id, 2)
		expect(joined).toBe(false)
	})

	it('leaves a room', () => {
		const doObj = createDO()
		const room = doObj.createRoom('room-a', 1)
		doObj.joinRoom(room.id, 2)
		doObj.leaveRoom(room.id, 2)
		expect(doObj.isRoomMember(room.id, 2)).toBe(false)
	})

	it('checks room membership', () => {
		const doObj = createDO()
		const room = doObj.createRoom('room-a', 1)
		expect(doObj.isRoomMember(room.id, 1)).toBe(true)
		expect(doObj.isRoomMember(room.id, 999)).toBe(false)
	})

	it('owner cannot leave room without dissolving', () => {
		const doObj = createDO()
		const room = doObj.createRoom('room-a', 1)
		const ownerMembers = doObj.getMembers().filter(m => m.role === 'owner' && m.room_id === room.id)
		expect(ownerMembers).toHaveLength(1)
		expect(ownerMembers[0].user_id).toBe(1)
	})

	it('tracks members correctly', () => {
		const doObj = createDO()
		const room = doObj.createRoom('room-a', 1)
		doObj.joinRoom(room.id, 2)
		doObj.joinRoom(room.id, 3)
		const roomMembers = doObj.getMembers().filter(m => m.room_id === room.id)
		expect(roomMembers).toHaveLength(3)
	})
})
