<template>
	<div class="app-container">
		<ChatApp />
	</div>
</template>

<script setup lang="ts">
import ChatApp from './components/ChatApp.vue'
</script>

<style scoped>
.app-container {
	height: 100%;
	display: flex;
	flex-direction: column;
}
</style>
