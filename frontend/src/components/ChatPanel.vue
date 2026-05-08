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
      <div class="chat-top-inner">
        <div class="bot-profile">
          <div class="avatar-bot" aria-hidden="true">
            <svg viewBox="0 0 48 48" class="bot-svg">
              <rect x="8" y="12" width="32" height="28" rx="6" fill="currentColor" opacity="0.2" />
              <rect x="12" y="18" width="24" height="18" rx="4" fill="currentColor" opacity="0.35" />
              <circle cx="18" cy="26" r="3" fill="currentColor" />
              <circle cx="30" cy="26" r="3" fill="currentColor" />
              <rect x="20" y="32" width="8" height="2" rx="1" fill="currentColor" opacity="0.6" />
              <circle cx="24" cy="8" r="3" fill="currentColor" opacity="0.5" />
              <path
                d="M24 11v5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                opacity="0.5"
              />
            </svg>
          </div>
          <div class="bot-meta">
            <span class="bot-eyebrow">智能助手</span>
            <div class="bot-name-row">
              <span class="bot-name">深迪小助手</span>
              <span class="bot-status">在线</span>
            </div>
            <p class="bot-desc">基于公司已上传制度文档为您解答</p>
          </div>
        </div>
        <el-button
          class="clear-btn"
          size="small"
          round
          plain
          type="danger"
          :disabled="chat.sending || chat.messages.length === 0"
          @click="chat.clearChat"
        >
          清空会话
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="!auth.isAuthenticated"
      class="login-tip"
      type="info"
      :closable="false"
      show-icon
      title="登录后可使用助手，基于已上传的制度文档回答问题。"
    />

    <div ref="listRef" class="msg-scroll">
      <div v-if="chat.messages.length === 0" class="welcome">
        <div class="welcome-card">
          <div class="welcome-avatar" aria-hidden="true">
            <div class="welcome-avatar-ring">
              <svg viewBox="0 0 64 64" class="bot-svg-lg">
                <rect x="10" y="18" width="44" height="36" rx="8" fill="var(--el-color-primary-light-7)" />
                <rect x="16" y="26" width="32" height="22" rx="5" fill="var(--el-color-primary-light-5)" />
                <circle cx="26" cy="35" r="4" fill="var(--el-color-primary)" />
                <circle cx="38" cy="35" r="4" fill="var(--el-color-primary)" />
                <rect x="28" y="42" width="8" height="3" rx="1.5" fill="var(--el-color-primary-dark-2)" />
                <circle cx="32" cy="10" r="4" fill="var(--el-color-primary)" opacity="0.6" />
                <path
                  d="M32 14v8"
                  stroke="var(--el-color-primary)"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </div>
          </div>
          <h2 class="welcome-title">你好，我是深迪小助手</h2>
          <p class="welcome-text">
            试试下面示例，或直接描述与请假、报销、设备领用相关的问题。
          </p>
          <div class="chips">
            <button
              v-for="(s, i) in suggestions"
              :key="i"
              type="button"
              class="suggestion-chip"
              :disabled="!auth.isAuthenticated"
              @click="chat.useSuggestion(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-for="(m, idx) in chat.messages"
        :key="idx"
        class="msg-row"
        :class="m.role"
      >
        <template v-if="m.role === 'assistant'">
          <div class="avatar-bot sm" aria-hidden="true">
            <svg viewBox="0 0 48 48" class="bot-svg">
              <rect x="8" y="12" width="32" height="28" rx="6" fill="currentColor" opacity="0.2" />
              <rect x="12" y="18" width="24" height="18" rx="4" fill="currentColor" opacity="0.35" />
              <circle cx="18" cy="26" r="3" fill="currentColor" />
              <circle cx="30" cy="26" r="3" fill="currentColor" />
              <rect x="20" y="32" width="8" height="2" rx="1" fill="currentColor" opacity="0.6" />
              <circle cx="24" cy="8" r="3" fill="currentColor" opacity="0.5" />
              <path
                d="M24 11v5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                opacity="0.5"
              />
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
      <div class="composer-inner">
        <el-input
          v-model="chat.input"
          class="composer-input"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 5 }"
          resize="none"
          size="large"
          placeholder="输入问题，Enter 发送 · Shift+Enter 换行"
          :disabled="chat.sending || !auth.isAuthenticated"
          @keydown.enter.exact.prevent="onSend"
        />
        <el-button
          type="primary"
          class="send-btn"
          size="large"
          round
          :loading="chat.sending"
          :disabled="!chat.input.trim() || !auth.isAuthenticated"
          @click="onSend"
        >
          发送
        </el-button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.chat-shell {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 120px);
  max-width: 820px;
  margin: 0 auto;
  background: linear-gradient(145deg, var(--nm-surface-2, #f2f5fa), var(--nm-surface, #eef1f7));
  border-radius: var(--nm-radius-lg, 22px);
  border: none;
  box-shadow: var(--nm-raise);
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
  background: linear-gradient(180deg, #f0f3fa, #e8ecf4);
}

.chat-top {
  flex-shrink: 0;
  padding: 0;
  border-bottom: none;
  background: transparent;
}

.chat-top-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}

.bot-profile {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.avatar-bot {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(145deg, #f2f5fa, #e4e9f2);
  color: var(--nm-primary-deep, #9b8cc4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--nm-raise-sm);
}

.avatar-bot.sm {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  align-self: flex-end;
  margin-bottom: 4px;
  box-shadow: var(--nm-raise-sm);
}

.bot-svg {
  width: 34px;
  height: 34px;
}

.avatar-bot.sm .bot-svg {
  width: 28px;
  height: 28px;
}

.bot-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bot-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--el-color-primary);
  opacity: 0.85;
}

.bot-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.bot-name {
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.bot-status {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  padding: 3px 10px;
  border-radius: 999px;
}

.bot-desc {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.clear-btn {
  flex-shrink: 0;
}

.login-tip {
  flex-shrink: 0;
  margin: 0;
  border-radius: 0;
}

.login-tip :deep(.el-alert__title) {
  font-size: 13px;
  line-height: 1.5;
}

.msg-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 18px 24px;
  min-height: 0;
  background: linear-gradient(165deg, #eef1f7 0%, #e8ecf4 55%, #ebe8f1 100%);
}

.welcome {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px;
}

.welcome-card {
  width: 100%;
  max-width: 440px;
  padding: 28px 22px 26px;
  text-align: center;
  border-radius: var(--nm-radius-lg, 22px);
  background: rgba(255, 255, 255, 0.28);
  border: none;
  box-shadow: var(--nm-raise);
  backdrop-filter: blur(14px);
}

@supports not (backdrop-filter: blur(14px)) {
  .welcome-card {
    background: linear-gradient(145deg, #f4f6fb, #e8ecf4);
  }
}

.welcome-avatar {
  margin: 0 auto 18px;
  width: 88px;
  height: 88px;
}

.welcome-avatar-ring {
  width: 100%;
  height: 100%;
  border-radius: 22px;
  padding: 6px;
  background: linear-gradient(135deg, #ddd2f0, #e8ecf4);
  box-shadow: var(--nm-raise-sm);
}

.welcome-avatar-ring .bot-svg-lg {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: var(--el-bg-color);
}

.bot-svg-lg {
  width: 76px;
  height: 76px;
  margin: 0 auto;
}

.welcome-title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.welcome-text {
  margin: 0 0 22px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.suggestion-chip {
  appearance: none;
  border: none;
  background: linear-gradient(145deg, #f4f6fb, #e8ecf4);
  color: var(--nm-text, #5c6478);
  font-size: 13px;
  line-height: 1.4;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: var(--nm-raise-sm);
  transition: box-shadow 0.18s ease, transform 0.12s ease, color 0.15s ease;
}

.suggestion-chip:hover:not(:disabled) {
  color: var(--nm-primary-deep, #9b8cc4);
  box-shadow: var(--nm-raise);
  transform: translateY(-1px);
}

.suggestion-chip:active:not(:disabled) {
  box-shadow: var(--nm-press);
  transform: scale(0.99);
}

.suggestion-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.msg-row {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
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
  max-width: min(82%, 580px);
  min-width: 0;
}

.msg-col.user-col {
  align-items: flex-end;
}

.msg-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--el-text-color-placeholder);
  margin-bottom: 6px;
  padding-left: 6px;
  text-transform: none;
}

.msg-label.user-label {
  padding-left: 0;
  padding-right: 6px;
}

.bubble {
  border-radius: 18px;
  padding: 12px 16px;
  line-height: 1.6;
  font-size: 14px;
}

.bot-bubble {
  background: linear-gradient(145deg, #f6f8fc, #eef1f7);
  color: var(--nm-text, #4a5162);
  border: none;
  border-bottom-left-radius: 6px;
  box-shadow: var(--nm-raise-sm);
}

.user-bubble {
  background: linear-gradient(135deg, #d4caeb, #b5a8d9);
  color: #fff;
  border: none;
  border-bottom-right-radius: 6px;
  box-shadow: var(--nm-raise-sm);
}

.bubble-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.avatar-user {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: linear-gradient(145deg, #f2f5fa, #e4e9f2);
  color: var(--nm-text-soft, #8a93a6);
  font-weight: 700;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  align-self: flex-end;
  margin-bottom: 4px;
  border: none;
  box-shadow: var(--nm-raise-sm);
}

.typing {
  display: inline-flex;
  gap: 5px;
  padding: 6px 2px;
  align-items: center;
}

.typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-primary);
  opacity: 0.45;
  animation: bounce 1.15s infinite ease-in-out both;
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
    transform: translateY(2px) scale(0.75);
    opacity: 0.35;
  }
  40% {
    transform: translateY(0) scale(1);
    opacity: 0.95;
  }
}

.composer-bar {
  flex-shrink: 0;
  padding: 0;
  border-top: none;
  background: transparent;
  box-shadow: none;
}

.composer-inner {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 14px 18px 18px;
  max-width: 100%;
}

.composer-input {
  flex: 1;
  min-width: 0;
}

.composer-input :deep(.el-textarea__inner) {
  border-radius: var(--nm-radius-sm, 14px);
}

.send-btn {
  flex-shrink: 0;
  padding: 12px 24px;
  font-weight: 600;
}
</style>
