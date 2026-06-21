import ResponseFrame from './framework'
import { json } from './framework-utils'
import config from './config'
import type { Middleware, HandlerFn } from './types'
export { ChatRoomDO } from './chat-do'

async function fetchUserFromApi(token: string): Promise<{ uid: number; name: string } | null> {
	try {
		const res = await fetch(`${config.apiBase}/serive/v0/self_info`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` },
		})
		const data = await res.json() as any
		if (data.code === 200 && data.data?.uid) {
			return { uid: data.data.uid, name: data.data.name }
		}
	} catch {}
	return null
}

function getRoomDO(env: Env) {
	return env.CHAT_ROOM_DO.getByName('main')
}

const authRequired: Middleware = async (context, next) => {
	const auth = context.request.headers.get('Authorization')
	if (!auth?.startsWith('Bearer ')) {
		return json({ code: -1, error: 'unauthorized' }, 401)
	}
	const token = auth.slice(7)
	const user = await fetchUserFromApi(token)
	if (!user) {
		return json({ code: -1, error: 'unauthorized' }, 401)
	}
	context.paramMap.set('__user', JSON.stringify(user))
	context.paramMap.set('__token', token)
	return next()
}

const getUserRooms: HandlerFn = async (data, _, __, env) => {
	const user = JSON.parse(data.get('__user')!)
	const rooms = await getRoomDO(env).getUserRooms(user.uid)
	return json({ code: 200, data: { rooms } })
}

const createRoom: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { name: string }
	if (!body.name?.trim()) return json({ code: -1, error: 'name required' }, 400)
	const room = await getRoomDO(env).createRoom(body.name.trim(), user.uid)
	return json({ code: 200, data: { room } }, 201)
}

const listAllRooms: HandlerFn = async (_, __, ___, env) => {
	const rooms = await getRoomDO(env).listRooms()
	return json({ code: 200, data: { rooms } })
}

const joinRoom: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { room_id: number }
	await getRoomDO(env).joinRoom(body.room_id, user.uid)
	return json({ code: 200, data: { ok: true } })
}

const leaveRoom: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { room_id: number }
	const role = await getRoomDO(env).getMemberRole(body.room_id, user.uid)
	if (role === 'owner') return json({ code: -1, error: 'owner cannot leave' }, 400)
	await getRoomDO(env).leaveRoom(body.room_id, user.uid)
	return json({ code: 200, data: { ok: true } })
}

const getMessages: HandlerFn = async (data, request, url, env) => {
	const user = JSON.parse(data.get('__user')!)
	const roomId = parseInt(url.searchParams.get('room_id') || '')
	if (!roomId) return json({ code: -1, error: 'room_id required' }, 400)
	const stub = getRoomDO(env)
	const isMember = await stub.isRoomMember(roomId, user.uid)
	if (!isMember) return json({ code: -1, error: 'not a member' }, 403)
	const limit = parseInt(url.searchParams.get('limit') || '50')
	const messages = await stub.getMessages(roomId, limit)
	return json({ code: 200, data: { messages } })
}

const sendMessage: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { room_id: number; content: string }
	if (!body.content?.trim()) return json({ code: -1, error: 'content required' }, 400)
	const stub = getRoomDO(env)
	const isMember = await stub.isRoomMember(body.room_id, user.uid)
	if (!isMember) return json({ code: -1, error: 'not a member' }, 403)
	const msg = await stub.sendMessage(body.room_id, user.uid, user.name, body.content.trim())
	if (!msg) return json({ code: -1, error: 'you are muted' }, 403)
	return json({ code: 200, data: { message: msg } }, 201)
}

const getUserInfo: HandlerFn = async (data) => {
	const user = JSON.parse(data.get('__user')!)
	return json({ code: 200, data: { user } })
}

const proxyOauthToken: HandlerFn = async (_, request) => {
	const body = await request.json() as Record<string, string>
	try {
		const res = await fetch(`${config.apiBase}/oauth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = await res.json() as object
		return json(data, res.status)
	} catch {
		return json({ code: -1, error: 'proxy error' }, 502)
	}
}

const proxyLogout: HandlerFn = async (data, request) => {
	const token = request.headers.get('Authorization')
	try {
		const res = await fetch(`${config.apiBase}/serive/v0/logout`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: token } : {}),
			},
			body: '{}',
		})
		const body = await res.json() as object
		return json(body, res.status)
	} catch {
		return json({ code: -1, error: 'proxy error' }, 502)
	}
}

// --- New handlers ---

const getRoomMembers: HandlerFn = async (data, request, url, env) => {
	const user = JSON.parse(data.get('__user')!)
	const roomId = parseInt(url.searchParams.get('room_id') || '')
	if (!roomId) return json({ code: -1, error: 'room_id required' }, 400)
	const stub = getRoomDO(env)
	const isMember = await stub.isRoomMember(roomId, user.uid)
	if (!isMember) return json({ code: -1, error: 'not a member' }, 403)
	const members = await stub.getRoomMembers(roomId)
	return json({ code: 200, data: { members } })
}

const setMemberRole: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { room_id: number; user_id: number; role: string }
	if (!['admin', 'member'].includes(body.role)) return json({ code: -1, error: 'invalid role' }, 400)
	const stub = getRoomDO(env)
	const myRole = await stub.getMemberRole(body.room_id, user.uid)
	if (myRole !== 'owner') return json({ code: -1, error: 'only owner can set role' }, 403)
	await stub.setMemberRole(body.room_id, body.user_id, body.role)
	return json({ code: 200, data: { ok: true } })
}

const muteMemberHandler: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { room_id: number; user_id: number; duration: number }
	if (!body.duration || body.duration < 1) return json({ code: -1, error: 'invalid duration' }, 400)
	const stub = getRoomDO(env)
	const myRole = await stub.getMemberRole(body.room_id, user.uid)
	if (myRole !== 'owner' && myRole !== 'admin') return json({ code: -1, error: 'no permission' }, 403)
	const targetRole = await stub.getMemberRole(body.room_id, body.user_id)
	if (targetRole === 'owner') return json({ code: -1, error: 'cannot mute owner' }, 403)
	const until = new Date(Date.now() + body.duration * 60000).toISOString().replace('T', ' ').slice(0, 19)
	await stub.muteMember(body.room_id, body.user_id, until)
	return json({ code: 200, data: { ok: true } })
}

const unmuteMemberHandler: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { room_id: number; user_id: number }
	const stub = getRoomDO(env)
	const myRole = await stub.getMemberRole(body.room_id, user.uid)
	if (myRole !== 'owner' && myRole !== 'admin') return json({ code: -1, error: 'no permission' }, 403)
	await stub.unmuteMember(body.room_id, body.user_id)
	return json({ code: 200, data: { ok: true } })
}

const updateRoomHandler: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { room_id: number; name?: string; description?: string }
	const stub = getRoomDO(env)
	const myRole = await stub.getMemberRole(body.room_id, user.uid)
	if (myRole !== 'owner' && myRole !== 'admin') return json({ code: -1, error: 'no permission' }, 403)
	const current = await stub.getRoomById(body.room_id)
	if (!current) return json({ code: -1, error: 'room not found' }, 404)
	await stub.updateRoom(body.room_id,
		body.name?.trim() || current.name,
		body.description !== undefined ? body.description : current.description
	)
	const updated = await stub.getRoomById(body.room_id)
	return json({ code: 200, data: { room: updated } })
}

const dissolveRoom: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { room_id: number }
	const stub = getRoomDO(env)
	const myRole = await stub.getMemberRole(body.room_id, user.uid)
	if (myRole !== 'owner') return json({ code: -1, error: 'only owner can dissolve' }, 403)
	await stub.dissolveRoom(body.room_id)
	return json({ code: 200, data: { ok: true } })
}

const createPrivateChat: HandlerFn = async (data, request, _, env) => {
	const user = JSON.parse(data.get('__user')!)
	const body = await request.json() as { user_id: number }
	if (body.user_id === user.uid) return json({ code: -1, error: 'cannot chat with self' }, 400)
	const room = await getRoomDO(env).createPrivateRoom(user.uid, body.user_id)
	return json({ code: 200, data: { room } })
}

const getPrivateRooms: HandlerFn = async (data, _, __, env) => {
	const user = JSON.parse(data.get('__user')!)
	const rooms = await getRoomDO(env).getPrivateRooms(user.uid)
	return json({ code: 200, data: { rooms } })
}

const getPrivatePeer: HandlerFn = async (data, request, url, env) => {
	const user = JSON.parse(data.get('__user')!)
	const roomId = parseInt(url.searchParams.get('room_id') || '')
	if (!roomId) return json({ code: -1, error: 'room_id required' }, 400)
	const peer = await getRoomDO(env).getPrivatePeer(roomId, user.uid)
	return json({ code: 200, data: { peer } })
}

const getUserProfile: HandlerFn = async (data, request, url) => {
	const uidStr = url.searchParams.get('uid')
	if (!uidStr) return json({ code: -1, error: 'uid required' }, 400)
	const profile = { uid: parseInt(uidStr), name: '' }
	return json({ code: 200, data: { user: profile } })
}

const searchRoomsHandler: HandlerFn = async (data, request, url, env) => {
	const q = url.searchParams.get('q') || ''
	if (!q.trim()) return json({ code: 200, data: { rooms: [] } })
	const rooms = await getRoomDO(env).searchRooms(q.trim())
	return json({ code: 200, data: { rooms } })
}

const searchUsersHandler: HandlerFn = async (data, request, url, env) => {
	const q = url.searchParams.get('q') || ''
	if (!q.trim()) return json({ code: 200, data: { users: [] } })
	const users = await getRoomDO(env).searchUsers(q.trim())
	return json({ code: 200, data: { users } })
}

const fetchUserProfile: HandlerFn = async (data, request, url, env) => {
	const uidStr = url.searchParams.get('uid')
	if (!uidStr) return json({ code: -1, error: 'uid required' }, 400)
	const uid = parseInt(uidStr)
	const profile = getRoomDO(env).getUserProfile(uid)
	if (!profile) return json({ code: -1, error: 'user not found' }, 404)
	try {
		const token = data.get('__token')
		const res = await fetch(`${config.apiBase}/serive/v0/self_info`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` },
		})
		const apiData = await res.json() as any
		if (apiData.code === 200 && apiData.data) {
			return json({ code: 200, data: { user: { uid: apiData.data.uid, name: apiData.data.name } } })
		}
	} catch {}
	return json({ code: 200, data: { user: profile } })
}

function createHandler(env: Env, fn: HandlerFn): HandlerFn {
	return (data, request, url) => fn(data, request, url, env)
}

async function handleWebSocketUpgrade(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url)
	const token = url.searchParams.get('token')
	const roomId = url.searchParams.get('room_id')
	if (!token || !roomId) return json({ code: -1, error: 'token and room_id required' }, 400)

	const user = await fetchUserFromApi(token)
	if (!user) return json({ code: -1, error: 'unauthorized' }, 401)

	const stub = getRoomDO(env)
	const isMember = await stub.isRoomMember(parseInt(roomId), user.uid)
	if (!isMember) return json({ code: -1, error: 'not a member' }, 403)

	const pair = new WebSocketPair()
	const doUrl = `http://do/ws?room_id=${roomId}&user_id=${user.uid}`
	await stub.fetch(doUrl, { webSocket: pair[1] } as any)
	return new Response(null, { status: 101, webSocket: pair[0] })
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url)
		if (url.pathname === '/api/chat/ws' && request.headers.get('Upgrade') === 'websocket') {
			return handleWebSocketUpgrade(request, env)
		}

		const frame = new ResponseFrame(request)

		const api = [
			'/api/user/info', '/api/user/profile',
			'/api/chat/rooms', '/api/chat/rooms/create', '/api/chat/rooms/join', '/api/chat/rooms/leave',
			'/api/chat/rooms/members', '/api/chat/rooms/update', '/api/chat/rooms/dissolve',
			'/api/chat/rooms/mute', '/api/chat/rooms/unmute', '/api/chat/rooms/role',
			'/api/chat/rooms/private', '/api/chat/rooms/private/list', '/api/chat/rooms/private/peer',
			'/api/chat/rooms/search', '/api/chat/users/search',
			'/api/chat/messages', '/api/chat/messages/send',
		]
		frame.use(api, authRequired)

		frame.post('/api/auth/oauth/token', createHandler(env, proxyOauthToken))
		frame.post('/api/auth/logout', createHandler(env, proxyLogout))
		frame.get('/api/user/info', createHandler(env, getUserInfo))
		frame.get('/api/user/profile', createHandler(env, fetchUserProfile))
		frame.get('/api/chat/rooms', createHandler(env, getUserRooms))
		frame.get('/api/chat/rooms/all', createHandler(env, listAllRooms))
		frame.get('/api/chat/rooms/members', createHandler(env, getRoomMembers))
		frame.get('/api/chat/rooms/private/list', createHandler(env, getPrivateRooms))
		frame.get('/api/chat/rooms/private/peer', createHandler(env, getPrivatePeer))
		frame.post('/api/chat/rooms/create', createHandler(env, createRoom))
		frame.post('/api/chat/rooms/join', createHandler(env, joinRoom))
		frame.post('/api/chat/rooms/leave', createHandler(env, leaveRoom))
		frame.post('/api/chat/rooms/update', createHandler(env, updateRoomHandler))
		frame.post('/api/chat/rooms/dissolve', createHandler(env, dissolveRoom))
		frame.post('/api/chat/rooms/mute', createHandler(env, muteMemberHandler))
		frame.post('/api/chat/rooms/unmute', createHandler(env, unmuteMemberHandler))
		frame.post('/api/chat/rooms/private', createHandler(env, createPrivateChat))
		frame.get('/api/chat/messages', createHandler(env, getMessages))
		frame.post('/api/chat/rooms/role', createHandler(env, setMemberRole))
		frame.get('/api/chat/rooms/search', createHandler(env, searchRoomsHandler))
		frame.get('/api/chat/users/search', createHandler(env, searchUsersHandler))
		frame.post('/api/chat/messages/send', createHandler(env, sendMessage))

		return await frame.handlerRequest()
	},
} satisfies ExportedHandler<Env>
