export interface User {
	uid: number
	name: string
}

export interface ChatRoom {
	id: number
	name: string
	description: string
	created_at: string
	updated_at: string
	created_by: number
	owner_id: number
}

export interface RoomMember {
	room_id: number
	user_id: number
	role: string
	muted_until: string | null
	joined_at: string
}

export interface ChatMessage {
	id: number
	room_id: number
	user_id: number
	user_name: string
	content: string
	created_at: string
}

export interface CachedUser {
	uid: number
	name: string
	cached_at: number
}

export interface Language {
	appName: string
	login: string
	logout: string
	send: string
	inputPlaceholder: string
	chatRooms: string
	createRoom: string
	roomName: string
	roomDescription: string
	join: string
	leave: string
	dissolve: string
	confirmDissolve: string
	delete: string
	search: string
	searchPlaceholder: string
	noRooms: string
	noMessages: string
	settings: string
	darkMode: string
	language: string
	confirm: string
	cancel: string
	loading: string
	loginRequired: string
	selectRoom: string
	loginNow: string
	back: string
	online: string
	muted: string
	members: string
	create: string
	allRooms: string
	myRooms: string
	privateChat: string
	owner: string
	admin: string
	member: string
	setAdmin: string
	setMember: string
	mute: string
	unmute: string
	muteDuration: string
	minutes: string
	editGroup: string
	groupName: string
	groupDescription: string
	save: string
	startPrivateChat: string
	viewProfile: string
	friends: string
}
