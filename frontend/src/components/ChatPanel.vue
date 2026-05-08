<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { useAssistantChatStore } from "../stores/assistantChat";

withDefaults(
  defineProps<{
    variant?: "page" | "drawer";
  }>(),
  { variant: "page" }
);

const auth = useAuthStore();
const chat = useAssistantChatStore();
const listRef = ref<HTMLElement | null>(null);

const userInitial = computed(() => {
  const u = auth.username?.trim();
  if (!u) return "我";
  return u.slice(0, 1).toUpperCase();
});

function scrollBottom() {
  nextTick(() => {
    const el = listRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

async function onSend() {
  await chat.send(scrollBottom);
}

const suggestions = [
  "年假可以休几天？",
  "出差住宿费标准是多少？",
  "请假流程怎么走？",
];
</script>

<template>
  <div class="chat-shell" :class="{ 'chat-shell--drawer': variant === 'drawer' }">
    <header class="chat-top">
      <div class="bot-profile">
        <div class="avatar-bot" aria-hidden="true">
          <svg viewBox="0 0 48 48" class="bot-svg">
            <rect x="8" y="12" width="32" height="28" rx="6" fill="currentColor" opacity="0.2" />
            <rect x="12" y="18" width="24" height="18" rx="4" fill="currentColor" opacity="0.35" />
            <circle cx="18" cy="26" r="3" fill="currentColor" />
            <circle cx="30" cy="26" r="3" fill="currentColor" />
            <rect x="20" y="32" width="8" height="2" rx="1" fill="currentColor" opacity="0.6" />
            <circle cx="24" cy="8" r="3" fill="currentColor" opacity="0.5" />
            <path d="M24 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5" />
          </svg>
        </div>
        <div class="bot-meta">
          <div class="bot-name-row">
            <span class="bot-name">深迪小助手</span>
            <span class="bot-status">在线</span>
          </div>
          <p class="bot-desc">基于公司已上传制度文档为您解答</p>
        </div>
      </div>
      <el-button text type="danger" class="clear-btn" @click="chat.clearChat" :disabled="chat.sending">
        清空会话
      </el-button>
    </header>

    <el-alert v-if="!auth.isAuthenticated" class="login-tip" type="info" :closable="false" show-icon
      title="登录后可使用助手，基于已上传的制度文档回答问题。" />

    <div ref="listRef" class="msg-scroll">
      <div v-if="chat.messages.length === 0" class="welcome">
        <div class="welcome-avatar" aria-hidden="true">
          <svg viewBox="0 0 64 64" class="bot-svg-lg">
            <rect x="10" y="18" width="44" height="36" rx="8" fill="var(--el-color-primary-light-7)" />
            <rect x="16" y="26" width="32" height="22" rx="5" fill="var(--el-color-primary-light-5)" />
            <circle cx="26" cy="35" r="4" fill="var(--el-color-primary)" />
            <circle cx="38" cy="35" r="4" fill="var(--el-color-primary)" />
            <rect x="28" y="42" width="8" height="3" rx="1.5" fill="var(--el-color-primary-dark-2)" />
            <circle cx="32" cy="10" r="4" fill="var(--el-color-primary)" opacity="0.6" />
            <path d="M32 14v8" stroke="var(--el-color-primary)" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <h2 class="welcome-title">你好，我是深迪小助手</h2>
        <p class="welcome-text">试试下面问题，或直接输入与请假、报销、领用设备相关的问题。</p>
        <div class="chips">
          <el-button v-for="(s, i) in suggestions" :key="i" round plain type="primary" size="small"
            :disabled="!auth.isAuthenticated" @click="chat.useSuggestion(s)">
            {{ s }}
          </el-button>
        </div>
      </div>

      <div v-for="(m, idx) in chat.messages" :key="idx" class="msg-row" :class="m.role">
        <template v-if="m.role === 'assistant'">
          <div class="avatar-bot sm" aria-hidden="true">
            <svg viewBox="0 0 48 48" class="bot-svg">
              <rect x="8" y="12" width="32" height="28" rx="6" fill="currentColor" opacity="0.2" />
              <rect x="12" y="18" width="24" height="18" rx="4" fill="currentColor" opacity="0.35" />
              <circle cx="18" cy="26" r="3" fill="currentColor" />
              <circle cx="30" cy="26" r="3" fill="currentColor" />
              <rect x="20" y="32" width="8" height="2" rx="1" fill="currentColor" opacity="0.6" />
              <circle cx="24" cy="8" r="3" fill="currentColor" opacity="0.5" />
              <path d="M24 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5" />
            </svg>
          </div>
          <div class="msg-col">
            <span class="msg-label">深迪小助手</span>
            <div class="bubble bot-bubble">
              <span v-if="chat.sending && !m.content" class="typing">
                <span></span><span></span><span></span>
              </span>
              <div v-else class="bubble-text">{{ m.content }}</div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="msg-col user-col">
            <span class="msg-label user-label">{{ auth.username || "我" }}</span>
            <div class="bubble user-bubble">
              <div class="bubble-text">{{ m.content }}</div>
            </div>
          </div>
          <div class="avatar-user" :title="auth.username || '我'">
            {{ userInitial }}
          </div>
        </template>
      </div>
    </div>

    <footer class="composer-bar">
      <el-input v-model="chat.input" class="composer-input" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }"
        resize="none" placeholder="输入问题，Enter 发送，Shift+Enter 换行" :disabled="chat.sending || !auth.isAuthenticated"
        @keydown.enter.exact.prevent="onSend" />
      <el-button type="primary" class="send-btn" round :loading="chat.sending"
        :disabled="!chat.input.trim() || !auth.isAuthenticated" @click="onSend">
        发送
      </el-button>
    </footer>
  </div>
</template>

<style scoped>
.chat-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px - 32px);
  max-width: 800px;
  margin: 0 auto;
  background: var(--el-bg-color);
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: var(--el-box-shadow-light);
  overflow: hidden;
}

.chat-shell--drawer {
  height: 100%;
  max-width: none;
  margin: 0;
  border-radius: 0;
  border: none;
  box-shadow: none;
  min-height: 0;
}

.login-tip {
  flex-shrink: 0;
  margin: 0;
  border-radius: 0;
}

.chat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(180deg, var(--el-fill-color-blank) 0%, var(--el-bg-color) 100%);
  flex-shrink: 0;
}

.bot-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.avatar-bot {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--el-color-primary-light-7), var(--el-color-primary-light-9));
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-bot.sm {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  align-self: flex-end;
  margin-bottom: 4px;
}

.bot-svg {
  width: 32px;
  height: 32px;
}

.avatar-bot.sm .bot-svg {
  width: 26px;
  height: 26px;
}

.bot-meta {
  min-width: 0;
}

.bot-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bot-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.bot-status {
  font-size: 11px;
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  padding: 2px 8px;
  border-radius: 999px;
}

.bot-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clear-btn {
  flex-shrink: 0;
}

.msg-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
  background: linear-gradient(180deg, var(--el-fill-color-lighter) 0%, var(--el-fill-color-extra-light) 100%);
}

.welcome {
  text-align: center;
  padding: 32px 16px 24px;
  max-width: 420px;
  margin: 0 auto;
}

.welcome-avatar {
  margin: 0 auto 16px;
  width: 80px;
  height: 80px;
}

.bot-svg-lg {
  width: 80px;
  height: 80px;
}

.welcome-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.welcome-text {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.msg-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  align-items: flex-end;
}

.msg-row.assistant {
  justify-content: flex-start;
}

.msg-row.user {
  justify-content: flex-end;
}

.msg-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: min(78%, 560px);
  min-width: 0;
}

.msg-col.user-col {
  align-items: flex-end;
}

.msg-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
  padding-left: 4px;
}

.msg-label.user-label {
  padding-left: 0;
  padding-right: 4px;
}

.bubble {
  border-radius: 14px;
  padding: 10px 14px;
  line-height: 1.55;
  font-size: 14px;
}

.bot-bubble {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color-lighter);
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.user-bubble {
  background: var(--el-color-primary);
  color: #fff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.bubble-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.avatar-user {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--el-color-info-light-8);
  color: var(--el-color-info);
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  align-self: flex-end;
  margin-bottom: 4px;
}

.typing {
  display: inline-flex;
  gap: 4px;
  padding: 4px 0;
  align-items: center;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary-light-3);
  animation: bounce 1.2s infinite ease-in-out both;
}

.typing span:nth-child(1) {
  animation-delay: -0.24s;
}

.typing span:nth-child(2) {
  animation-delay: -0.12s;
}

@keyframes bounce {

  0%,
  80%,
  100% {
    transform: scale(0.65);
    opacity: 0.5;
  }

  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.composer-bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  flex-shrink: 0;
}

.composer-input {
  flex: 1;
}

.composer-input :deep(.el-textarea__inner) {
  border-radius: 20px;
  padding: 10px 16px;
  min-height: 40px;
  line-height: 1.5;
}

.send-btn {
  flex-shrink: 0;
  padding: 10px 22px;
}
</style>
