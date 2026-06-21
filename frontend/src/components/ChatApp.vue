<template>
	<div v-if="isLoading" class="loading-screen">
		<div class="loading-spinner"></div>
		<p>{{ t('loading') }}</p>
	</div>
	<div v-else class="chat-layout">
		<div class="sidebar">
			<div class="sidebar-header" @click="showSettings = !showSettings">
				<div class="avatar" v-if="loginUser">
					{{ loginUser.name.charAt(0).toUpperCase() }}
				</div>
				<div class="avatar avatar-login" v-else>?</div>
				<div class="user-info" v-if="loginUser">
					<span class="user-name">{{ loginUser.name }}</span>
					<span class="user-status">{{ t('online') }}</span>
				</div>
				<div class="user-info" v-else @click.stop="handleLogin">
					<span class="user-name">{{ t('login') }}</span>
				</div>
			</div>

			<div class="sidebar-tabs">
				<button :class="{ active: tab === 'my' }" @click="tab = 'my'">{{ t('myRooms') }}</button>
				<button :class="{ active: tab === 'all' }" @click="tab = 'all'">{{ t('allRooms') }}</button>
				<button :class="{ active: tab === 'private' }" @click="tab = 'private'">{{ t('privateChat') }}</button>
			</div>

			<div class="search-box">
				<input v-model="searchQuery" :placeholder="t('searchPlaceholder')" />
			</div>

			<div v-if="searchQuery.trim()" class="room-list">
				<div class="search-section-label">{{ t('chatRooms') }}</div>
				<div v-if="searchRooms.length === 0" class="empty-state">{{ t('noRooms') }}</div>
				<div v-for="room in searchRooms" :key="'r'+room.id"
					:class="['room-item', { active: currentRoom?.id === room.id }]"
					@click="selectRoom(room)">
					<div class="room-avatar">{{ room.name.charAt(0).toUpperCase() }}</div>
					<div class="room-info">
						<span class="room-name">{{ room.name }}</span>
					</div>
					<button v-if="!isMyRoom(room.id)" class="btn-join" @click.stop="joinRoom(room)">{{ t('join') }}</button>
				</div>
				<div class="search-section-label">{{ t('friends') }}</div>
				<div v-if="searchUsers.length === 0" class="empty-state">{{ t('noRooms') }}</div>
				<div v-for="u in searchUsers" :key="'u'+u.uid"
					class="room-item" @click="startPrivateChat(u.uid)">
					<div class="room-avatar">{{ u.name.charAt(0).toUpperCase() }}</div>
					<div class="room-info">
						<span class="room-name">{{ u.name }}</span>
						<span class="room-meta">UID: {{ u.uid }}</span>
					</div>
					<button class="btn-join" @click.stop="startPrivateChat(u.uid)">{{ t('startPrivateChat') }}</button>
				</div>
			</div>

			<div v-else-if="tab === 'my'" class="room-list">
				<div v-if="myRooms.length === 0" class="empty-state">{{ t('noRooms') }}</div>
				<div v-for="room in filteredMyRooms" :key="room.id"
					:class="['room-item', { active: currentRoom?.id === room.id && currentRoom?.description !== '__private__' }]"
					@click="selectRoom(room)">
					<div class="room-avatar">{{ room.name.charAt(0).toUpperCase() }}</div>
					<div class="room-info">
						<span class="room-name">{{ room.name }}</span>
					</div>
				</div>
			</div>

			<div v-else-if="tab === 'all'" class="room-list">
				<div v-if="allRooms.length === 0" class="empty-state">{{ t('noRooms') }}</div>
				<div v-for="room in filteredAllRooms" :key="room.id"
					:class="['room-item', { active: currentRoom?.id === room.id }]"
					@click="selectRoom(room)">
					<div class="room-avatar">{{ room.name.charAt(0).toUpperCase() }}</div>
					<div class="room-info">
						<span class="room-name">{{ room.name }}</span>
					</div>
					<button v-if="!isMyRoom(room.id)" class="btn-join" @click.stop="joinRoom(room)">{{ t('join') }}</button>
					<button v-else class="btn-leave" @click.stop="leaveRoom(room)">{{ t('leave') }}</button>
				</div>
			</div>

			<div v-else class="room-list">
				<div v-if="privateRooms.length === 0" class="empty-state">{{ t('noRooms') }}</div>
				<div v-for="room in privateRooms" :key="room.id"
					:class="['room-item', { active: currentRoom?.id === room.id && currentRoom?.description === '__private__' }]"
					@click="selectPrivateRoom(room)">
					<div class="room-avatar">{{ (privatePeerNames[room.id] || '?').charAt(0).toUpperCase() }}</div>
					<div class="room-info">
						<span class="room-name">{{ privatePeerNames[room.id] || t('privateChat') }}</span>
					</div>
				</div>
			</div>

			<div class="sidebar-footer">
				<button class="btn-create" @click="showCreate = true">{{ t('createRoom') }}</button>
			</div>
		</div>

		<div class="main-area">
			<div v-if="!currentRoom" class="welcome">
				<div class="welcome-icon">💬</div>
				<h2>{{ t('appName') }}</h2>
				<p>{{ loggedIn ? t('selectRoom') : t('loginRequired') }}</p>
			</div>

			<div v-else class="chat-view">
				<div class="chat-header">
					<div class="chat-header-left">
						<span class="chat-room-name">{{ roomDisplayName }}</span>
						<span class="chat-room-meta" v-if="currentRoom.description !== '__private__'">
							{{ t('members') }} {{ members.length }}
						</span>
					</div>
					<div class="header-actions">
						<button v-if="currentRoom.description !== '__private__'" class="btn-icon" @click="showMembersPanel = !showMembersPanel" title="成员">👥</button>
						<button class="btn-icon" @click="showSettings = !showSettings" title="设置">⚙️</button>
					</div>
				</div>

				<div class="messages" ref="messagesRef">
					<div v-if="messages.length === 0" class="empty-state">{{ t('noMessages') }}</div>
					<div v-for="msg in messages" :key="msg.id"
						:class="['message', { 'message-self': msg.user_id === loginUser?.uid }]">
						<div class="message-avatar" @click="showMemberProfile(msg.user_id)">{{ msg.user_name.charAt(0).toUpperCase() }}</div>
						<div class="message-body">
							<div class="message-meta">
								<span class="message-user" @click="showMemberProfile(msg.user_id)">{{ msg.user_name }}</span>
								<span class="message-time">{{ formatTime(msg.created_at) }}</span>
							</div>
							<div class="message-content" v-html="renderMarkdown(msg.content)"></div>
						</div>
					</div>
				</div>

				<div class="input-area">
					<textarea v-model="inputText" :placeholder="t('inputPlaceholder')"
						@keydown.enter.exact="sendMessage" rows="2"></textarea>
					<button class="btn-send" @click="sendMessage">{{ t('send') }}</button>
				</div>
			</div>
		</div>

		<div v-if="showMembersPanel && currentRoom && currentRoom.description !== '__private__'" class="members-panel">
			<div class="members-header">
				<span>{{ t('members') }} ({{ members.length }})</span>
				<button class="btn-icon" @click="showMembersPanel = false">✕</button>
			</div>
			<div class="members-list">
				<div v-for="m in members" :key="m.user_id" class="member-item">
					<div class="member-avatar">{{ (userNameMap[m.user_id] || '?').charAt(0).toUpperCase() }}</div>
					<div class="member-info">
						<span class="member-name">{{ userNameMap[m.user_id] || `#${m.user_id}` }}</span>
						<span class="member-role-badge" :class="m.role">{{ roleLabel(m.role) }}</span>
						<span v-if="m.muted_until" class="muted-badge">{{ t('muted') }}</span>
					</div>
					<div class="member-actions" v-if="canManage(m.user_id)">
						<button v-if="myRole === 'owner' && m.role === 'member'" class="btn-sm" @click="setRole(m.user_id, 'admin')">{{ t('setAdmin') }}</button>
						<button v-if="myRole === 'owner' && m.role === 'admin'" class="btn-sm" @click="setRole(m.user_id, 'member')">{{ t('setMember') }}</button>
						<button v-if="!m.muted_until && m.role !== 'owner'" class="btn-sm" @click="startMute(m.user_id)">{{ t('mute') }}</button>
						<button v-if="m.muted_until && m.role !== 'owner'" class="btn-sm" @click="unmuteMember(m.user_id)">{{ t('unmute') }}</button>
					</div>
					<button class="btn-sm btn-chat" @click="startPrivateChat(m.user_id)">{{ t('startPrivateChat') }}</button>
				</div>
			</div>
			<div class="members-footer" v-if="canManage(0)">
				<button class="btn-sm" @click="showEditRoom = true">{{ t('editGroup') }}</button>
				<button v-if="myRole === 'owner'" class="btn-sm btn-danger" @click="confirmDissolve">{{ t('dissolve') }}</button>
			</div>
		</div>

		<div v-if="showEditRoom && currentRoom" class="modal-overlay" @click.self="showEditRoom = false">
			<div class="modal">
				<h3>{{ t('editGroup') }}</h3>
				<input v-model="editRoomName" :placeholder="t('groupName')" class="modal-input" />
				<textarea v-model="editRoomDesc" :placeholder="t('groupDescription')" class="modal-input" rows="3"></textarea>
				<div class="modal-actions">
					<button class="btn-cancel" @click="showEditRoom = false">{{ t('cancel') }}</button>
					<button class="btn-confirm" @click="saveRoomSettings">{{ t('save') }}</button>
				</div>
			</div>
		</div>

		<div v-if="showMuteModal" class="modal-overlay" @click.self="showMuteModal = false">
			<div class="modal">
				<h3>{{ t('mute') }}</h3>
				<input v-model.number="muteDuration" type="number" :placeholder="t('muteDuration')" class="modal-input" min="1" />
				<div class="modal-actions">
					<button class="btn-cancel" @click="showMuteModal = false">{{ t('cancel') }}</button>
					<button class="btn-confirm" @click="confirmMute">{{ t('confirm') }}</button>
				</div>
			</div>
		</div>

		<div v-if="showProfileModal && profileUser" class="modal-overlay" @click.self="showProfileModal = false">
			<div class="modal modal-sm">
				<div class="profile-header">
					<div class="profile-avatar">{{ profileUser.name.charAt(0).toUpperCase() }}</div>
					<div class="profile-info">
						<span class="profile-name">{{ profileUser.name }}</span>
						<span class="profile-uid">UID: {{ profileUser.uid }}</span>
					</div>
				</div>
				<div class="modal-actions">
					<button class="btn-confirm" @click="startPrivateChat(profileUser.uid)">{{ t('startPrivateChat') }}</button>
					<button class="btn-cancel" @click="showProfileModal = false">{{ t('cancel') }}</button>
				</div>
			</div>
		</div>

		<div v-if="showSettings" class="settings-panel">
			<div class="settings-header">{{ t('settings') }}</div>
			<div class="settings-body">
				<label class="setting-row">
					<span>{{ t('darkMode') }}</span>
					<input type="checkbox" :checked="isDark" @change="toggleDark" />
				</label>
				<label class="setting-row">
					<span>{{ t('language') }}</span>
					<select :value="currentLang" @change="switchLang">
						<option value="zh">中文</option>
						<option value="en">English</option>
					</select>
				</label>
				<button v-if="loggedIn" class="btn-logout" @click="handleLogout">{{ t('logout') }}</button>
			</div>
		</div>

		<div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
			<div class="modal">
				<h3>{{ t('createRoom') }}</h3>
				<input v-model="newRoomName" :placeholder="t('roomName')" class="modal-input" />
				<div class="modal-actions">
					<button class="btn-cancel" @click="showCreate = false">{{ t('cancel') }}</button>
					<button class="btn-confirm" @click="createRoom">{{ t('create') }}</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storage } from '../utils/storage'
import { useLogin, checkLogin, logout as doLogout, goLogin } from '../utils/loginStatus'
import { apiGet, apiPost } from '../utils/request'
import { t, setLang, getLang } from '../i18n'
import type { ChatRoom, ChatMessage, RoomMember } from '../types'

const { user: loginUser, isLogin: loggedIn, isLoading } = useLogin()
const tab = ref<'my' | 'all' | 'private'>('my')
const searchQuery = ref('')
const currentRoom = ref<ChatRoom | null>(null)
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const showSettings = ref(false)
const showCreate = ref(false)
const showMembersPanel = ref(false)
const showEditRoom = ref(false)
const showMuteModal = ref(false)
const showProfileModal = ref(false)
const newRoomName = ref('')
const editRoomName = ref('')
const editRoomDesc = ref('')
const muteTargetId = ref(0)
const muteDuration = ref(5)
const profileUser = ref<{ uid: number; name: string } | null>(null)
const myRooms = ref<ChatRoom[]>([])
const allRooms = ref<ChatRoom[]>([])
const privateRooms = ref<ChatRoom[]>([])
const members = ref<RoomMember[]>([])
const privatePeerNames = ref<Record<number, string>>({})
const userNameMap = ref<Record<number, string>>({})
const messagesRef = ref<HTMLElement | null>(null)
const currentLang = ref(getLang())
const isDark = ref(localStorage.getItem('hauchat_theme') === 'dark')

const searchRooms = ref<ChatRoom[]>([])
const searchUsers = ref<{ uid: number; name: string }[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (val) => {
	if (searchTimer) clearTimeout(searchTimer)
	if (!val.trim()) {
		searchRooms.value = []
		searchUsers.value = []
		return
	}
	searchTimer = setTimeout(() => doSearch(val.trim()), 300)
})

async function doSearch(q: string) {
	if (!loggedIn.value) return
	try {
		const [rData, uData] = await Promise.all([
			apiGet<{ code: number; data?: { rooms: ChatRoom[] } }>(`/api/chat/rooms/search?q=${encodeURIComponent(q)}`),
			apiGet<{ code: number; data?: { users: { uid: number; name: string }[] } }>(`/api/chat/users/search?q=${encodeURIComponent(q)}`),
		])
		searchRooms.value = rData.data?.rooms || []
		searchUsers.value = uData.data?.users || []
	} catch {}
}

let ws: WebSocket | null = null

function wsConnect(roomId: number) {
	wsDisconnect()
	const token = storage.get('token')
	if (!token) return
	const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
	const url = `${protocol}://${location.host}/api/chat/ws?room_id=${roomId}&token=${encodeURIComponent(token)}`
	try {
		ws = new WebSocket(url)
		ws.addEventListener('message', (event) => {
			try {
				const data = JSON.parse(event.data)
				if (data.type === 'new_message' && data.message.user_id !== loginUser.value?.uid) {
					messages.value.push(data.message)
					nextTick(() => {
						if (messagesRef.value) {
							messagesRef.value.scrollTop = messagesRef.value.scrollHeight
						}
					})
				}
			} catch {}
		})
		ws.addEventListener('close', () => { ws = null })
		ws.addEventListener('error', () => { ws = null })
	} catch { ws = null }
}

function wsDisconnect() {
	if (ws) {
		try { ws.close() } catch {}
		ws = null
	}
}

onUnmounted(wsDisconnect)

const myRole = computed(() => {
	if (!currentRoom.value || !loginUser.value) return ''
	const m = members.value.find(mm => mm.user_id === loginUser.value!.uid)
	return m?.role || ''
})

const roomDisplayName = computed(() => {
	if (!currentRoom.value) return ''
	if (currentRoom.value.description === '__private__') {
		return privatePeerNames.value[currentRoom.value.id] || t('privateChat')
	}
	return currentRoom.value.name
})

const filteredMyRooms = computed(() => {
	if (!searchQuery.value) return myRooms.value
	return myRooms.value.filter(r => r.name.includes(searchQuery.value))
})

const filteredAllRooms = computed(() => {
	if (!searchQuery.value) return allRooms.value
	return allRooms.value.filter(r => r.name.includes(searchQuery.value))
})

function isMyRoom(roomId: number): boolean {
	return myRooms.value.some(r => r.id === roomId)
}

function roleLabel(role: string): string {
	return role === 'owner' ? t('owner') : role === 'admin' ? t('admin') : t('member')
}

function canManage(targetUserId: number): boolean {
	if (!loginUser.value) return false
	if (targetUserId === loginUser.value.uid) return false
	return myRole.value === 'owner' || myRole.value === 'admin'
}

function formatTime(dateStr: string): string {
	try {
		const d = new Date(dateStr + 'Z')
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	} catch { return '' }
}

function renderMarkdown(text: string): string {
	let html = text
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	html = html
		.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/### (.+)/g, '<h3>$1</h3>')
		.replace(/## (.+)/g, '<h2>$1</h2>')
		.replace(/# (.+)/g, '<h1>$1</h1>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.replace(/~~([^~]+)~~/g, '<del>$1</del>')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="nofollow">$1</a>')
		.replace(/\n/g, '<br>')
	return html
}

function toggleDark() {
	isDark.value = !isDark.value
	if (isDark.value) {
		document.documentElement.setAttribute('data-theme', 'dark')
		localStorage.setItem('hauchat_theme', 'dark')
	} else {
		document.documentElement.removeAttribute('data-theme')
		localStorage.setItem('hauchat_theme', 'light')
	}
}

function switchLang(e: Event) {
	const val = (e.target as HTMLSelectElement).value
	setLang(val)
	currentLang.value = val
}

async function loadMembers() {
	if (!currentRoom.value) return
	try {
		const data = await apiGet<{ code: number; data?: { members: RoomMember[] } }>(`/api/chat/rooms/members?room_id=${currentRoom.value.id}`)
		members.value = data.data?.members || []
		members.value.forEach(m => {
			if (!userNameMap.value[m.user_id]) {
				userNameMap.value[m.user_id] = ''
			}
		})
		await loadMemberNames()
	} catch (e) {
		console.error('Failed to load members', e)
	}
}

async function loadMemberNames() {
	const ids = members.value.filter(m => !userNameMap.value[m.user_id]).map(m => m.user_id)
	for (const uid of ids) {
		try {
			const data = await apiGet<{ code: number; data?: { user: { uid: number; name: string } } }>(`/api/user/profile?uid=${uid}`)
			if (data.data?.user?.name) {
				userNameMap.value[uid] = data.data.user.name
			}
		} catch {}
	}
}

async function loadRooms() {
	if (!loggedIn.value) return
	try {
		const [myData, allData, privateData] = await Promise.all([
			apiGet<{ code: number; data?: { rooms: ChatRoom[] } }>('/api/chat/rooms'),
			apiGet<{ code: number; data?: { rooms: ChatRoom[] } }>('/api/chat/rooms/all'),
			apiGet<{ code: number; data?: { rooms: ChatRoom[] } }>('/api/chat/rooms/private/list'),
		])
		myRooms.value = myData.data?.rooms || []
		allRooms.value = allData.data?.rooms || []
		privateRooms.value = privateData.data?.rooms || []
		await loadPrivatePeerNames()
	} catch (e) {
		console.error('Failed to load rooms', e)
	}
}

async function loadPrivatePeerNames() {
	for (const room of privateRooms.value) {
		try {
			const data = await apiGet<{ code: number; data?: { peer: number } }>(`/api/chat/rooms/private/peer?room_id=${room.id}`)
			const peerUid = data.data?.peer
			if (peerUid) {
				const userData = await apiGet<{ code: number; data?: { user: { uid: number; name: string } } }>(`/api/user/profile?uid=${peerUid}`)
				privatePeerNames.value[room.id] = userData.data?.user?.name || `#${peerUid}`
				userNameMap.value[peerUid] = privatePeerNames.value[room.id]
			}
		} catch {}
	}
}

async function selectRoom(room: ChatRoom) {
	currentRoom.value = room
	messages.value = []
	members.value = []
	showMembersPanel.value = false
	wsDisconnect()
	try {
		const data = await apiGet<{ code: number; data?: { messages: ChatMessage[] } }>(`/api/chat/messages?room_id=${room.id}`)
		messages.value = (data.data?.messages || []).reverse()
		if (room.description !== '__private__') {
			await loadMembers()
		}
		wsConnect(room.id)
		await nextTick()
		if (messagesRef.value) {
			messagesRef.value.scrollTop = messagesRef.value.scrollHeight
		}
	} catch (e) {
		console.error('Failed to load messages', e)
	}
}

async function selectPrivateRoom(room: ChatRoom) {
	await selectRoom(room)
}

async function sendMessage() {
	if (!inputText.value.trim() || !currentRoom.value || !loggedIn.value) return
	const content = inputText.value.trim()
	inputText.value = ''
	try {
		const data = await apiPost<{ code: number; data?: { message: ChatMessage }; error?: string }>('/api/chat/messages/send', {
			room_id: currentRoom.value.id,
			content,
		})
		if (data.data?.message) {
			messages.value.push(data.data.message)
			await nextTick()
			if (messagesRef.value) {
				messagesRef.value.scrollTop = messagesRef.value.scrollHeight
			}
		} else if (data.error === 'you are muted') {
			alert(t('muted'))
		}
	} catch (e) {
		console.error('Failed to send message', e)
	}
}

async function joinRoom(room: ChatRoom) {
	if (!loggedIn.value) return
	try {
		await apiPost('/api/chat/rooms/join', { room_id: room.id })
		await loadRooms()
		currentRoom.value = room
		tab.value = 'my'
	} catch (e) {
		console.error('Failed to join room', e)
	}
}

async function leaveRoom(room: ChatRoom) {
	if (!loggedIn.value) return
	try {
		await apiPost('/api/chat/rooms/leave', { room_id: room.id })
		if (currentRoom.value?.id === room.id) {
			currentRoom.value = null
			messages.value = []
		}
		await loadRooms()
	} catch (e: unknown) {
		const err = e as { data?: { error?: string }; error?: string; message?: string }
		const errorMsg = (err?.data || err)?.error || err?.message || 'unknown error'
		if (errorMsg === 'owner cannot leave') {
			alert(t('dissolve'))
		}
	}
}

async function createRoom() {
	if (!newRoomName.value.trim() || !loggedIn.value) return
	try {
		const data = await apiPost<{ code: number; data?: { room: ChatRoom } }>('/api/chat/rooms/create', { name: newRoomName.value.trim() })
		if (data.data?.room) {
			await loadRooms()
			currentRoom.value = data.data.room
			tab.value = 'my'
			showCreate.value = false
			newRoomName.value = ''
		}
	} catch (e) {
		console.error('Failed to create room', e)
	}
}

async function setRole(userId: number, role: string) {
	if (!currentRoom.value) return
	try {
		await apiPost('/api/chat/rooms/role', { room_id: currentRoom.value.id, user_id: userId, role })
		await loadMembers()
	} catch (e) {
		console.error('Failed to set role', e)
	}
}

function startMute(userId: number) {
	muteTargetId.value = userId
	muteDuration.value = 5
	showMuteModal.value = true
}

async function confirmMute() {
	if (!currentRoom.value) return
	try {
		await apiPost('/api/chat/rooms/mute', {
			room_id: currentRoom.value.id,
			user_id: muteTargetId.value,
			duration: muteDuration.value,
		})
		showMuteModal.value = false
		await loadMembers()
	} catch (e) {
		console.error('Failed to mute', e)
	}
}

async function unmuteMember(userId: number) {
	if (!currentRoom.value) return
	try {
		await apiPost('/api/chat/rooms/unmute', { room_id: currentRoom.value.id, user_id: userId })
		await loadMembers()
	} catch (e) {
		console.error('Failed to unmute', e)
	}
}

async function saveRoomSettings() {
	if (!currentRoom.value) return
	try {
		const data = await apiPost<{ code: number; data?: { room: ChatRoom } }>('/api/chat/rooms/update', {
			room_id: currentRoom.value.id,
			name: editRoomName.value,
			description: editRoomDesc.value,
		})
		if (data.data?.room) {
			currentRoom.value = data.data.room
			showEditRoom.value = false
			await loadRooms()
		}
	} catch (e) {
		console.error('Failed to update room', e)
	}
}

async function confirmDissolve() {
	if (!currentRoom.value || !confirm(t('confirmDissolve'))) return
	try {
		await apiPost('/api/chat/rooms/dissolve', { room_id: currentRoom.value.id })
		currentRoom.value = null
		messages.value = []
		showMembersPanel.value = false
		await loadRooms()
	} catch (e) {
		console.error('Failed to dissolve', e)
	}
}

async function startPrivateChat(userId: number) {
	if (userId === loginUser.value?.uid) return
	try {
		const data = await apiPost<{ code: number; data?: { room: ChatRoom } }>('/api/chat/rooms/private', { user_id: userId })
		if (data.data?.room) {
			await loadRooms()
			tab.value = 'private'
			await selectPrivateRoom(data.data.room)
			showProfileModal.value = false
		}
	} catch (e) {
		console.error('Failed to create private chat', e)
	}
}

function showMemberProfile(userId: number) {
	if (!userId) return
	const name = userNameMap.value[userId] || `#${userId}`
	profileUser.value = { uid: userId, name }
	showProfileModal.value = true
}

async function handleLogin() {
	goLogin()
}

async function handleLogout() {
	await doLogout()
	currentRoom.value = null
	messages.value = []
	myRooms.value = []
	allRooms.value = []
	privateRooms.value = []
}

onMounted(async () => {
	const isLoggedIn = await checkLogin()
	if (isLoggedIn) {
		await loadRooms()
	} else {
		goLogin()
	}
})
</script>

<style scoped>
.loading-screen {
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16px;
	color: var(--text-secondary);
}

.loading-spinner {
	width: 32px;
	height: 32px;
	border: 3px solid var(--border-color);
	border-top-color: var(--accent);
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	to { transform: rotate(360deg); }
}

.chat-layout {
	display: flex;
	height: 100%;
	position: relative;
}

.sidebar {
	width: 280px;
	min-width: 280px;
	background: var(--bg-sidebar);
	display: flex;
	flex-direction: column;
	border-right: 1px solid var(--border-sidebar);
}

.sidebar-header {
	display: flex;
	align-items: center;
	padding: 16px;
	gap: 12px;
	cursor: pointer;
	border-bottom: 1px solid var(--border-sidebar);
}

.avatar {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	background: var(--accent);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
	font-size: 16px;
	flex-shrink: 0;
	cursor: pointer;
}

.avatar-login {
	background: var(--text-muted);
}

.user-info {
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.user-name {
	color: var(--text-sidebar-active);
	font-weight: 600;
	font-size: 15px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.user-status {
	color: var(--text-sidebar);
	font-size: 12px;
}

.sidebar-tabs {
	display: flex;
	padding: 8px;
	gap: 4px;
}

.sidebar-tabs button {
	flex: 1;
	padding: 6px;
	background: transparent;
	color: var(--text-sidebar);
	border-radius: 4px;
	font-size: 12px;
	transition: all 0.2s;
	white-space: nowrap;
}

.sidebar-tabs button.active {
	background: var(--accent);
	color: white;
}

.sidebar-tabs button:hover:not(.active) {
	background: var(--bg-sidebar-hover);
}

.search-box {
	padding: 0 12px 8px;
}

.search-box input {
	width: 100%;
	padding: 8px 12px;
	background: var(--bg-sidebar-hover);
	color: var(--text-sidebar-active);
	border-radius: 20px;
	font-size: 13px;
}

.search-box input::placeholder {
	color: var(--text-sidebar);
}

.room-list {
	flex: 1;
	overflow-y: auto;
	padding: 4px 8px;
}

.room-item {
	display: flex;
	align-items: center;
	padding: 10px 12px;
	gap: 10px;
	border-radius: 8px;
	cursor: pointer;
	transition: background 0.15s;
}

.room-item:hover {
	background: var(--bg-sidebar-hover);
}

.room-item.active {
	background: var(--accent);
}

.room-item.active .room-name,
.room-item.active .room-meta {
	color: white;
}

.room-avatar {
	width: 36px;
	height: 36px;
	border-radius: 8px;
	background: var(--accent);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
	font-size: 14px;
	flex-shrink: 0;
}

.room-info {
	flex: 1;
	overflow: hidden;
}

.room-name {
	color: var(--text-sidebar-active);
	font-size: 14px;
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	display: block;
}

.room-meta {
	color: var(--text-sidebar);
	font-size: 12px;
}

.btn-join, .btn-leave {
	padding: 4px 12px;
	border-radius: 4px;
	font-size: 12px;
	background: transparent;
	border: 1px solid;
	flex-shrink: 0;
}

.btn-join {
	color: var(--accent);
	border-color: var(--accent);
}

.btn-join:hover {
	background: var(--accent);
	color: white;
}

.btn-leave {
	color: var(--danger);
	border-color: var(--danger);
}

.btn-leave:hover {
	background: var(--danger);
	color: white;
}

.sidebar-footer {
	padding: 12px;
	border-top: 1px solid var(--border-sidebar);
}

.btn-create {
	width: 100%;
	padding: 10px;
	background: var(--accent);
	color: white;
	border-radius: 8px;
	font-weight: 600;
}

.btn-create:hover {
	background: var(--accent-hover);
}

.main-area {
	flex: 1;
	display: flex;
	flex-direction: column;
	background: var(--bg-chat);
	min-width: 0;
}

.welcome {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	color: var(--text-secondary);
}

.welcome-icon {
	font-size: 64px;
}

.chat-view {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
}

.chat-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 20px;
	background: var(--bg-header);
	border-bottom: 1px solid var(--border-color);
}

.chat-header-left {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.chat-room-name {
	font-weight: 600;
	font-size: 16px;
}

.chat-room-meta {
	font-size: 12px;
	color: var(--text-secondary);
}

.header-actions {
	display: flex;
	gap: 8px;
}

.btn-icon {
	background: transparent;
	font-size: 18px;
	padding: 4px;
	border-radius: 4px;
	cursor: pointer;
}

.btn-icon:hover {
	background: var(--bg-hover);
}

.messages {
	flex: 1;
	overflow-y: auto;
	padding: 16px 20px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.message {
	display: flex;
	gap: 10px;
	max-width: 70%;
}

.message-self {
	align-self: flex-end;
	flex-direction: row-reverse;
}

.message-avatar {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background: var(--accent);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
	font-size: 13px;
	flex-shrink: 0;
	cursor: pointer;
}

.message-body {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.message-meta {
	display: flex;
	align-items: center;
	gap: 8px;
}

.message-user {
	font-size: 12px;
	color: var(--text-secondary);
	font-weight: 500;
	cursor: pointer;
}

.message-user:hover {
	color: var(--accent);
}

.message-time {
	font-size: 11px;
	color: var(--text-muted);
}

.message-content {
	padding: 10px 14px;
	border-radius: 12px;
	font-size: 14px;
	line-height: 1.5;
	word-break: break-word;
	background: var(--bg-message-other);
	color: var(--text-primary);
}

.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3) {
	margin: 4px 0;
	font-size: inherit;
}

.message-content :deep(pre) {
	background: var(--bg-code);
	padding: 8px;
	border-radius: 6px;
	overflow-x: auto;
	font-size: 13px;
	margin: 4px 0;
}

.message-content :deep(code) {
	background: var(--bg-code);
	padding: 1px 4px;
	border-radius: 3px;
	font-size: 13px;
}

.message-content :deep(a) {
	color: var(--accent);
	text-decoration: underline;
}

.message-self .message-content {
	background: var(--bg-message-self);
	color: var(--text-primary);
}

.input-area {
	display: flex;
	gap: 10px;
	padding: 12px 20px;
	background: var(--bg-header);
	border-top: 1px solid var(--border-color);
}

.input-area textarea {
	flex: 1;
	padding: 10px 14px;
	background: var(--bg-input);
	color: var(--text-primary);
	border-radius: 8px;
	resize: none;
	line-height: 1.4;
	min-height: 40px;
	max-height: 120px;
}

.btn-send {
	padding: 10px 24px;
	background: var(--accent);
	color: white;
	border-radius: 8px;
	font-weight: 600;
	align-self: flex-end;
}

.btn-send:hover {
	background: var(--accent-hover);
}

.members-panel {
	position: absolute;
	right: 0;
	top: 0;
	width: 300px;
	height: 100%;
	background: var(--bg-primary);
	border-left: 1px solid var(--border-color);
	box-shadow: var(--shadow);
	z-index: 10;
	display: flex;
	flex-direction: column;
}

.members-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 20px;
	font-weight: 600;
	font-size: 16px;
	border-bottom: 1px solid var(--border-color);
}

.members-list {
	flex: 1;
	overflow-y: auto;
	padding: 8px 12px;
}

.member-item {
	display: flex;
	align-items: center;
	padding: 8px 10px;
	gap: 10px;
	border-radius: 8px;
	flex-wrap: wrap;
}

.member-item:hover {
	background: var(--bg-hover);
}

.member-avatar {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background: var(--accent);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
	font-size: 13px;
	flex-shrink: 0;
}

.member-info {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 6px;
	flex-wrap: wrap;
}

.member-name {
	font-size: 14px;
	font-weight: 500;
}

.member-role-badge {
	font-size: 11px;
	padding: 1px 6px;
	border-radius: 10px;
}

.member-role-badge.owner {
	background: #ffd700;
	color: #000;
}

.member-role-badge.admin {
	background: var(--accent);
	color: white;
}

.member-role-badge.member {
	background: var(--bg-hover);
	color: var(--text-secondary);
}

.muted-badge {
	font-size: 11px;
	padding: 1px 6px;
	border-radius: 10px;
	background: var(--danger);
	color: white;
}

.member-actions {
	display: flex;
	gap: 4px;
	width: 100%;
	padding-left: 42px;
}

.btn-sm {
	padding: 3px 10px;
	border-radius: 4px;
	font-size: 12px;
	background: transparent;
	border: 1px solid var(--border-color);
	color: var(--text-primary);
	cursor: pointer;
}

.btn-sm:hover {
	background: var(--bg-hover);
}

.btn-danger {
	border-color: var(--danger);
	color: var(--danger);
}

.btn-danger:hover {
	background: var(--danger);
	color: white;
}

.btn-chat {
	border-color: var(--accent);
	color: var(--accent);
}

.btn-chat:hover {
	background: var(--accent);
	color: white;
}

.members-footer {
	padding: 12px 16px;
	border-top: 1px solid var(--border-color);
	display: flex;
	gap: 8px;
}

.profile-header {
	display: flex;
	align-items: center;
	gap: 16px;
	padding-bottom: 16px;
}

.profile-avatar {
	width: 48px;
	height: 48px;
	border-radius: 50%;
	background: var(--accent);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 600;
	font-size: 20px;
}

.profile-info {
	display: flex;
	flex-direction: column;
}

.profile-name {
	font-size: 16px;
	font-weight: 600;
}

.profile-uid {
	font-size: 12px;
	color: var(--text-secondary);
}

.settings-panel {
	position: absolute;
	right: 0;
	top: 0;
	width: 260px;
	height: 100%;
	background: var(--bg-primary);
	border-left: 1px solid var(--border-color);
	box-shadow: var(--shadow);
	z-index: 10;
	display: flex;
	flex-direction: column;
}

.settings-header {
	padding: 16px 20px;
	font-weight: 600;
	font-size: 16px;
	border-bottom: 1px solid var(--border-color);
}

.settings-body {
	padding: 16px 20px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.setting-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 14px;
	cursor: pointer;
}

.setting-row select {
	padding: 4px 8px;
	border-radius: 4px;
	border: 1px solid var(--border-color);
	background: var(--bg-input);
	color: var(--text-primary);
}

.btn-logout {
	padding: 10px;
	background: var(--danger);
	color: white;
	border-radius: 8px;
	width: 100%;
	font-weight: 600;
}

.btn-logout:hover {
	background: var(--danger-hover);
}

.modal-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0,0,0,0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 100;
}

.modal {
	background: var(--bg-primary);
	border-radius: var(--radius-lg);
	padding: 24px;
	width: 360px;
	box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

.modal-sm {
	width: 320px;
}

.modal h3 {
	margin-bottom: 16px;
	font-size: 18px;
}

.modal-input {
	width: 100%;
	padding: 10px 14px;
	background: var(--bg-input);
	color: var(--text-primary);
	border: 1px solid var(--border-color);
	border-radius: 8px;
	margin-bottom: 16px;
	font-family: inherit;
	font-size: 14px;
}

.modal-actions {
	display: flex;
	gap: 10px;
	justify-content: flex-end;
}

.btn-cancel, .btn-confirm {
	padding: 8px 20px;
	border-radius: 8px;
	font-weight: 500;
	cursor: pointer;
}

.btn-cancel {
	background: var(--bg-hover);
	color: var(--text-primary);
}

.btn-confirm {
	background: var(--accent);
	color: white;
}

.empty-state {
	text-align: center;
	padding: 40px 20px;
	color: var(--text-muted);
	font-size: 14px;
}

@media (max-width: 768px) {
	.sidebar {
		width: 100%;
		min-width: 0;
	}

	.main-area {
		display: none;
	}

	.chat-layout.has-chat .sidebar {
		display: none;
	}

	.chat-layout.has-chat .main-area {
		display: flex;
	}

	.message {
		max-width: 85%;
	}

	.settings-panel, .members-panel {
		width: 100%;
	}
}
</style>
