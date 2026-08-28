<script setup lang="ts">
/* 内联图标集（lucide 风格线性图标）—— 零依赖，支持霓虹描边 */
withDefaults(defineProps<{
  name: string
  size?: number | string
  glow?: boolean
  stroke?: number
}>(), { size: 18, glow: false, stroke: 1.75 })

const icons: Record<string, string> = {
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  gauge: 'M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  'check-circle': 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  'shield-alert': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10M12 8v4M12 16h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10',
  server: 'M5 2H3a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-2M5 6h14M5 10h14M5 14h14M5 18h14M7 4h.01M11 4h.01',
  'scroll-text': 'M19 17V5a2 2 0 0 0-2-2H4M8 21h12a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H8M8 3v18M14 8h2M14 12h2',
  settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  apps: 'M2 6h7M2 18h7M16 6h7M16 18h7M9 3v7M9 14v7M16 3v7M16 14v7',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  sun: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.35-4.35',
  menu: 'M3 6h18M3 12h18M3 18h18',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  'chevron-right': 'M9 18l6-6-6-6',
  'alert-triangle': 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  clock: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM12 6v6l4 2',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'git-branch': 'M6 3v12M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9v2c0 2-1 3-3 3H9',
  database: 'M12 8a8 8 0 1 0 0-6 8 8 0 0 0 0 6zM4 5.5v13c0 1.7 3.6 3.5 8 3.5s8-1.8 8-3.5v-13M4 12c0 1.7 3.6 3.5 8 3.5s8-1.8 8-3.5',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  radar: 'M19.07 4.93A10 10 0 1 1 5.83 5.83M19.07 4.93 12 12M17.66 6.34a8 8 0 1 1-5.32-1.51',
  'trending-up': 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  cpu: 'M9 9h6v6H9zM4 6h16M4 18h16M7 6V4M7 20v-2M17 6V4M17 20v-2M4 9v6M20 9v6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  mail: 'M4 4h16v16H4zM22 6l-10 7L2 6',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  'x-circle': 'M18 6 6 18M6 6l12 12M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  plus: 'M12 5v14M5 12h14',
}
</script>

<template>
  <svg
    class="tech-icon"
    :class="{ glow }"
    :width="size" :height="size" viewBox="0 0 24 24" fill="none"
    :stroke-width="stroke" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="icons[name] || icons.activity" />
  </svg>
</template>

<style scoped>
.tech-icon { display: inline-block; vertical-align: middle; flex: none; }
/* glow 已从设计系统退役：prop 保留兼容，视觉权重归零 */
.tech-icon.glow { filter: none; }
</style>
