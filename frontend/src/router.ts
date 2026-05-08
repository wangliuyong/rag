import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "./stores/auth";
import Login from "./views/Login.vue";
import Layout from "./views/Layout.vue";
import Dashboard from "./views/Dashboard.vue";
import Documents from "./views/Documents.vue";
import Chat from "./views/Chat.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: Login, meta: { public: true } },
    {
      path: "/",
      component: Layout,
      children: [
        { path: "", redirect: "/dashboard" },
        { path: "dashboard", name: "dashboard", component: Dashboard },
        { path: "documents", name: "documents", component: Documents },
        { path: "chat", name: "chat", component: Chat },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) {
    return next({ name: "login", query: { redirect: to.fullPath } });
  }
  if (to.name === "login" && auth.isAuthenticated) {
    return next({ name: "dashboard" });
  }
  next();
});
