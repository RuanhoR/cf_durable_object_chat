export interface User {
	uid: number
	name: string
}

export interface ChatRoom {
	id: number
	name: string
	created_at: string
	created_by: number
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
	join: string
	leave: string
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
	loginNow: string
	back: string
	online: string
	members: string
	create: string
	allRooms: string
	myRooms: string
	friends: string
}
