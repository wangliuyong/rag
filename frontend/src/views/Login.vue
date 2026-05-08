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
    const redirect = (route.query.redirect as string) || "/documents";
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
  background: linear-gradient(135deg, #eef2ff, #f8fafc);
}
.card {
  width: 400px;
}
.title {
  margin: 0 0 16px;
  text-align: center;
}
</style>
