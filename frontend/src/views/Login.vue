<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const form = reactive({
  username: "",
  password: "",
});
const loading = ref(false);

async function onSubmit() {
  loading.value = true;
  try {
    const { data } = await api.post<{ token: string; username: string }>(
      "/auth/login",
      form
    );
    auth.setSession(data.token, data.username);
    ElMessage.success("登录成功");
    const redirect = (route.query.redirect as string) || "/dashboard";
    router.replace(redirect);
  } catch {
    ElMessage.error("登录失败，请检查账号密码");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="wrap">
    <el-card class="card" shadow="hover">
      <h2 class="title">管理员登录</h2>
      <el-form :model="form" label-width="72px" @submit.prevent="onSubmit">
        <el-form-item label="账号">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" native-type="submit">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: radial-gradient(
      ellipse 80% 60% at 50% 0%,
      rgba(55, 90, 130, 0.35),
      transparent 55%
    ),
    linear-gradient(160deg, #0a0e14 0%, #0f1724 45%, #0c1018 100%);
}
.card {
  width: min(400px, 100%);
  border-radius: var(--adm-radius, 12px);
  border: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(
    165deg,
    rgba(28, 38, 56, 0.92) 0%,
    rgba(18, 26, 40, 0.96) 100%
  );
  box-shadow: var(--adm-shadow, 0 4px 20px rgba(0, 0, 0, 0.28));
}
.title {
  margin: 0 0 16px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
