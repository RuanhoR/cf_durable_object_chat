<template>
	<div class="redirecting">{{ t('loading') }}</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { t } from '../i18n'
import config from '../config'

onMounted(() => {
	const loginUrl = `${config.oauthLoginUrl}?response_type=code&client_id=${config.oauthClientId}&redirect_uri=${encodeURIComponent(config.oauthRedirectUri)}`
	window.location.href = loginUrl
})
</script>

<style scoped>
.redirecting {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: var(--text-secondary);
	font-size: 16px;
}
</style>
