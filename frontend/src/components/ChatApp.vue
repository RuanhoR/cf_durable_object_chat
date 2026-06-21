<template>
	<div class="chat-layout">
		<div class="sidebar">
			<div class="sidebar-header" @click="showSettings = !showSettings">
				<div class="avatar" v-if="login.user">
					{{ login.user.name.charAt(0).toUpperCase() }}
				</div>
				<div class="avatar avatar-login" v-else>
					?
				</div>
				<div class="user-info" v-if="login.user">
					<span class="user-name">{{ login.user.name }}</span>
					<span class="user-status">{{ t('online') }}</span>
				</div>
				<div class="user-info" v-else @click.stop="handleLogin">
					<span class="user-name">{{ t('login') }}</span>
				</div>
			</div>

			<div class="sidebar-tabs">
				<button :class="{ active: tab === 'my' }" @click="tab = 'my'">{{ t('myRooms') }}</button>
				<button :class="{ active: tab === 'all' }" @click="tab = 'all'">{{ t('allRooms') }}</button>
			</div>

			<div class="search-box">
				<input v-model="searchQuery" :placeholder="t('searchPlaceholder')" />
			</div>

			<div class="room-list" v-if="tab === 'my'">
				<div v-if="myRooms.length === 0" class="empty-state">{{ t('noRooms') }}</div>
				<div
					v-for="room in filteredMyRooms"
					:key="room.id"
					:class="['room-item', { active: currentRoom?.id === room.id }]"
					@click="selectRoom(room)"
				>
					<div class="room-avatar">{{ room.name.charAt(0).toUpperCase() }}</div>
					<div class="room-info">
						<span class="room-name">{{ room.name }}</span>
					</div>
				</div>
			</div>

			<div class="room-list" v-else>
				<div v-if="allRooms.length === 0" class="empty-state">{{ t('noRooms') }}</div>
				<div
					v-for="room in filteredAllRooms"
					:key="room.id"
					:class="['room-item', { active: currentRoom?.id === room.id }]"
					@click="selectRoom(room)"
				>
					<div class="room-avatar">{{ room.name.charAt(0).toUpperCase() }}</div>
					<div class="room-info">
						<span class="room-name">{{ room.name }}</span>
						<span class="room-meta">{{ room.created_by }} · {{ t('members') }}</span>
					</div>
					<button v-if="!isMyRoom(room.id)" class="btn-join" @click.stop="joinRoom(room)">{{ t('join') }}</button>
					<button v-else class="btn-leave" @click.stop="leaveRoom(room)">{{ t('leave') }}</button>
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
				<p>{{ t('loginRequired') }}</p>
			</div>

			<div v-else class="chat-view">
				<div class="chat-header">
					<span class="chat-room-name">{{ currentRoom.name }}</span>
					<div class="header-actions">
						<button class="btn-icon" @click="showSettings = !showSettings" title="设置">⚙️</button>
					</div>
				</div>

				<div class="messages" ref="messagesRef">
					<div v-if="messages.length === 0" class="empty-state">{{ t('noMessages') }}</div>
					<div
						v-for="msg in messages"
						:key="msg.id"
						:class="['message', { 'message-self': msg.user_id === login.user?.uid }]"
					>
						<div class="message-avatar">{{ msg.user_name.charAt(0).toUpperCase() }}</div>
						<div class="message-body">
							<div class="message-meta">
								<span class="message-user">{{ msg.user_name }}</span>
								<span class="message-time">{{ formatTime(msg.created_at) }}</span>
							</div>
							<div class="message-content">{{ msg.content }}</div>
						</div>
					</div>
				</div>

				<div class="input-area">
					<textarea
						v-model="inputText"
						:placeholder="t('inputPlaceholder')"
						@keydown.enter.exact="sendMessage"
						rows="2"
					></textarea>
					<button class="btn-send" @click="sendMessage">{{ t('send') }}</button>
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
				<button v-if="login.isLogin" class="btn-logout" @click="handleLogout">{{ t('logout') }}</button>
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
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useLogin, checkLogin, setToken, logout as doLogout } from '../utils/loginStatus'
import { apiGet, apiPost } from '../utils/request'
import { t, setLang, getLang } from '../i18n'
import type { ChatRoom, ChatMessage } from '../types'

const login = useLogin()
const tab = ref<'my' | 'all'>('my')
const searchQuery = ref('')
const currentRoom = ref<ChatRoom | null>(null)
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const showSettings = ref(false)
const showCreate = ref(false)
const newRoomName = ref('')
const myRooms = ref<ChatRoom[]>([])
const allRooms = ref<ChatRoom[]>([])
const messagesRef = ref<HTMLElement | null>(null)
const currentLang = ref(getLang())
const isDark = ref(localStorage.getItem('hauchat_theme') === 'dark')

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

function formatTime(dateStr: string): string {
	try {
		const d = new Date(dateStr + 'Z')
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	} catch { return '' }
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

async function loadRooms() {
	if (!login.isLogin) return
	try {
		const [myData, allData] = await Promise.all([
			apiGet('/api/chat/rooms'),
			apiGet('/api/chat/rooms/all'),
		])
		myRooms.value = (myData as any).rooms || []
		allRooms.value = (allData as any).rooms || []
	} catch (e) {
		console.error('Failed to load rooms', e)
	}
}

async function selectRoom(room: ChatRoom) {
	currentRoom.value = room
	messages.value = []
	try {
		const data: any = await apiGet(`/api/chat/messages?room_id=${room.id}`)
		messages.value = (data.messages || []).reverse()
		await nextTick()
		if (messagesRef.value) {
			messagesRef.value.scrollTop = messagesRef.value.scrollHeight
		}
	} catch (e) {
		console.error('Failed to load messages', e)
	}
}

async function sendMessage() {
	if (!inputText.value.trim() || !currentRoom.value || !login.isLogin) return
	const content = inputText.value.trim()
	inputText.value = ''
	try {
		const data: any = await apiPost('/api/chat/messages/send', {
			room_id: currentRoom.value.id,
			content,
		})
		if (data.message) {
			messages.value.push(data.message)
			await nextTick()
			if (messagesRef.value) {
				messagesRef.value.scrollTop = messagesRef.value.scrollHeight
			}
		}
	} catch (e) {
		console.error('Failed to send message', e)
	}
}

async function joinRoom(room: ChatRoom) {
	if (!login.isLogin) return
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
	if (!login.isLogin) return
	try {
		await apiPost('/api/chat/rooms/leave', { room_id: room.id })
		if (currentRoom.value?.id === room.id) {
			currentRoom.value = null
			messages.value = []
		}
		await loadRooms()
	} catch (e) {
		console.error('Failed to leave room', e)
	}
}

async function createRoom() {
	if (!newRoomName.value.trim() || !login.isLogin) return
	try {
		const data: any = await apiPost('/api/chat/rooms/create', { name: newRoomName.value.trim() })
		if (data.room) {
			await loadRooms()
			currentRoom.value = data.room
			tab.value = 'my'
			showCreate.value = false
			newRoomName.value = ''
		}
	} catch (e) {
		console.error('Failed to create room', e)
	}
}

async function handleLogin() {
	window.location.href = `/api/oauth/login`
}

function handleLogout() {
	doLogout()
	currentRoom.value = null
	messages.value = []
	myRooms.value = []
	allRooms.value = []
}

async function handleOAuthCallback() {
	const params = new URLSearchParams(location.search)
	const code = params.get('code')
	const token = params.get('token')

	if (code) {
		try {
			const data: any = await apiPost('/api/oauth/callback', { code })
			if (data.token) {
				setToken(data.token)
			}
		} catch (e) {
			console.error('OAuth callback failed', e)
		}
		const url = new URL(location.href)
		url.search = ''
		window.history.replaceState({}, '', url.toString())
	} else if (token) {
		setToken(token)
		const url = new URL(location.href)
		url.search = ''
		window.history.replaceState({}, '', url.toString())
	}
}

onMounted(async () => {
	await handleOAuthCallback()
	const loggedIn = await checkLogin()
	if (loggedIn) {
		await loadRooms()
	}
})
</script>

<style scoped>
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
	font-size: 13px;
	transition: all 0.2s;
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

.chat-room-name {
	font-weight: 600;
	font-size: 16px;
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

	.settings-panel {
		width: 100%;
	}
}
</style>
