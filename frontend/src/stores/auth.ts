import { defineStore } from "pinia";
import { ref, computed } from "vue";

const TOKEN_KEY = "company_rag_token";
const USER_KEY = "company_rag_username";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const username = ref<string | null>(localStorage.getItem(USER_KEY));

  const isAuthenticated = computed(() => Boolean(token.value));

  function setSession(t: string, user: string) {
    token.value = t;
    username.value = user;
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, user);
  }

  function clear() {
    token.value = null;
    username.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return { token, username, isAuthenticated, setSession, clear };
});
