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
	return json({ code: 200, data: { message: msg } }, 201)
}

const oauthLogin: HandlerFn = async () => {
	const loginUrl = `${config.apiBase}/oauth2?response_type=code&client_id=${config.oauthClientId}&redirect_uri=${encodeURIComponent(config.oauthRedirectUri)}`
	return Response.redirect(loginUrl, 302)
}

const oauthCallback: HandlerFn = async (_, request) => {
	const body = await request.json() as { code: string }
	if (!body.code) return json({ code: -1, error: 'code required' }, 400)
	const res = await fetch(`${config.apiBase}/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			code: body.code,
			client_id: config.oauthClientId,
			redirect_uri: config.oauthRedirectUri,
		}),
	})
	const r = await res.json() as any
	if (r.code !== 200 || !r.data?.token) {
		return json({ code: -1, error: 'token exchange failed' }, 400)
	}
	const user = await fetchUserFromApi(r.data.token)
	if (!user) return json({ code: -1, error: 'user lookup failed' }, 400)
	return json({ code: 200, data: { token: r.data.token, user } })
}

const getUserInfo: HandlerFn = async (data) => {
	const user = JSON.parse(data.get('__user')!)
	return json({ code: 200, data: { user } })
}

function createHandler(env: Env, fn: HandlerFn): HandlerFn {
	return (data, request, url) => fn(data, request, url, env)
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const frame = new ResponseFrame(request)

		frame.get('/api/oauth/login', oauthLogin)
		frame.post('/api/oauth/callback', oauthCallback)

		const api = ['/api/user/info', '/api/chat/rooms', '/api/chat/rooms/create', '/api/chat/rooms/join', '/api/chat/rooms/leave', '/api/chat/messages', '/api/chat/messages/send']
		frame.use(api, authRequired)

		frame.get('/api/user/info', createHandler(env, getUserInfo))
		frame.get('/api/chat/rooms', createHandler(env, getUserRooms))
		frame.get('/api/chat/rooms/all', createHandler(env, listAllRooms))
		frame.post('/api/chat/rooms/create', createHandler(env, createRoom))
		frame.post('/api/chat/rooms/join', createHandler(env, joinRoom))
		frame.post('/api/chat/rooms/leave', createHandler(env, leaveRoom))
		frame.get('/api/chat/messages', createHandler(env, getMessages))
		frame.post('/api/chat/messages/send', createHandler(env, sendMessage))

		return await frame.handlerRequest()
	},
} satisfies ExportedHandler<Env>
