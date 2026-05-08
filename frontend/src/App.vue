<script setup lang="ts">
import { RouterView } from "vue-router";
import FloatingAssistant from "./components/FloatingAssistant.vue";
</script>

<template>
  <el-config-provider namespace="el">
    <div class="nm-app">
      <RouterView />
      <FloatingAssistant />
    </div>
  </el-config-provider>
</template>

<style>
html,
body,
#app {
  min-height: 100%;
  min-height: 100dvh;
  margin: 0;
}
</style>
