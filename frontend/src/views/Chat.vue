<script setup lang="ts">
import ChatPanel from "../components/ChatPanel.vue";
</script>

<template>
  <div class="chat-page">
    <ChatPanel variant="page" />
  </div>
</template>

<style scoped>
.chat-page {
  height: 100%;
  min-height: 0;
}
</style>
