import { defineStore } from "pinia";
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { useAuthStore } from "./auth";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const useAssistantChatStore = defineStore("assistantChat", () => {
  const messages = ref<ChatMessage[]>([]);
  const input = ref("");
  const sending = ref(false);

  function clearChat() {
    messages.value = [];
    input.value = "";
  }

  function useSuggestion(text: string) {
    input.value = text;
  }

  async function streamIntoAssistant(
    userText: string,
    assistantMsg: ChatMessage,
    scroll: () => void
  ) {
    const auth = useAuthStore();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ message: userText }),
    });

    if (!res.ok || !res.body) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(data) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (json.type === "token" && typeof json.token === "string") {
          assistantMsg.content += json.token;
          scroll();
        } else if (json.type === "error") {
          throw new Error(String(json.message ?? "流式错误"));
        }
      }
    }
  }

  async function send(scroll: () => void) {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      ElMessage.warning("请先登录后再使用助手");
      return;
    }
    const text = input.value.trim();
    if (!text || sending.value) return;
    sending.value = true;
    messages.value.push({ role: "user", content: text });
    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    messages.value.push(assistantMsg);
    input.value = "";
    scroll();

    try {
      await streamIntoAssistant(text, assistantMsg, scroll);
    } catch (e) {
      assistantMsg.content =
        e instanceof Error ? e.message : "请求失败，请稍后重试";
      ElMessage.error("问答失败");
    } finally {
      sending.value = false;
      scroll();
    }
  }

  return {
    messages,
    input,
    sending,
    clearChat,
    useSuggestion,
    send,
  };
});
