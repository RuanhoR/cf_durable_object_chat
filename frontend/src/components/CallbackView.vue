<template>
	<div class="callback">
		<p>{{ t('loading') }}</p>
	</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiPost } from '../utils/request'
import { setToken } from '../utils/loginStatus'
import { t } from '../i18n'
import config from '../config'

const router = useRouter()

onMounted(async () => {
	const params = new URLSearchParams(location.search)
	const code = params.get('code')
	const tokenParam = params.get('token')
	const server = params.get('server')

	if (code) {
		try {
			const data: any = await apiPost('/oauth/token', {
				code,
				client_id: config.oauthClientId,
				redirect_uri: config.oauthRedirectUri,
			})
			if (data.code === 200 && data.data?.token) {
				setToken(data.data.token)
			}
		} catch (e) {
			console.error('OAuth token exchange failed', e)
		}
	} else if (tokenParam && server === 'account.ruanhor.dpdns.org') {
		setToken(tokenParam)
	}

	router.replace('/')
})
</script>

<style scoped>
.callback {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: var(--text-secondary);
	font-size: 16px;
}
</style>
