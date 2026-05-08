<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
  }>(),
  { size: 28 }
);
</script>

<template>
  <svg
    class="robot-icon"
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    aria-hidden="true"
  >
    <rect x="8" y="12" width="32" height="28" rx="6" fill="currentColor" opacity="0.22" />
    <rect x="12" y="18" width="24" height="18" rx="4" fill="currentColor" opacity="0.4" />
    <circle cx="18" cy="26" r="3" fill="currentColor" />
    <circle cx="30" cy="26" r="3" fill="currentColor" />
    <rect x="20" y="32" width="8" height="2" rx="1" fill="currentColor" opacity="0.65" />
    <circle cx="24" cy="8" r="3" fill="currentColor" opacity="0.55" />
    <path
      d="M24 11v5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      opacity="0.55"
    />
  </svg>
</template>

<style scoped>
.robot-icon {
  display: block;
}
</style>
