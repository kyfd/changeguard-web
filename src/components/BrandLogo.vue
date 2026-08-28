<script setup lang="ts">
/**
 * ChangeGuard 标识
 *
 * 盾牌代表治理边界；中间的实心横闩代表门禁。
 * 闩上方是待进入的变更，下方是生产环境 —— 闩把两者隔开。
 * variant="blocked" 时闩转为警示色，用于表达拦截态。
 */
withDefaults(
  defineProps<{
    size?: number | string
    variant?: 'default' | 'blocked'
    title?: string
  }>(),
  { size: 24, variant: 'default', title: '' },
)
</script>

<template>
  <svg
    class="logo"
    :class="variant"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :role="title ? 'img' : 'presentation'"
    :aria-hidden="title ? undefined : 'true'"
  >
    <title v-if="title">{{ title }}</title>

    <!-- 治理边界 -->
    <path
      class="logo-shield"
      d="M12 2.6 4.4 5.45v6.2c0 4.78 3.3 7.87 7.6 9.75 4.3-1.88 7.6-4.97 7.6-9.75v-6.2Z"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    />

    <!-- 门禁横闩 -->
    <rect class="logo-bar" x="7.1" y="10.9" width="9.8" height="2.2" rx="0.5" fill="currentColor" />

    <!-- 闩上方：待放行的变更 -->
    <rect class="logo-pending" x="10.85" y="6.6" width="2.3" height="2.3" rx="0.45" fill="currentColor" />
  </svg>
</template>

<style scoped>
.logo { display: block; flex: none; }
.logo-shield { opacity: 0.95; }
.logo-pending { opacity: 0.55; }
.logo.blocked .logo-bar { fill: var(--cinnabar); }
</style>
