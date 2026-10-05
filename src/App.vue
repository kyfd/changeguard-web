<script setup lang="ts">
import { RouterView } from 'vue-router'
import UiToastHost from '@/components/ui/UiToastHost.vue'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </RouterView>
  <UiToastHost />
</template>
