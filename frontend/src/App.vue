<script setup lang="ts">
import { RouterView } from "vue-router";
import FloatingAssistant from "./components/FloatingAssistant.vue";
</script>

<template>
  <el-config-provider namespace="el">
    <RouterView />
    <FloatingAssistant />
  </el-config-provider>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}
</style>
