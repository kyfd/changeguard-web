<script setup lang="ts">
import { computed } from 'vue'
import TechIcon from '@/components/TechIcon.vue'

const props = defineProps<{
  services: { id: string; name: string; count: number }[]
  available: boolean
  missing: boolean
}>()

const emit = defineEmits<{
  navigate: [target: string]
}>()

const serviceMax = computed(() =>
  Math.max(1, ...props.services.map((service) => service.count))
)
</script>

<template>
  <section class="instrument service-panel" data-testid="services-panel">
    <header class="panel-heading">
      <h2>服务变更量</h2>
      <span>02 / SERVICES</span>
    </header>

    <p v-if="!available || missing" class="empty-state">
      服务信息未能读取，暂不展示排行。
    </p>

    <ol v-else-if="services.length" class="service-list">
      <li
        v-for="(service, index) in services.slice(0, 5)"
        :key="service.id"
      >
        <div>
          <span class="ordinal">{{
            String(index + 1).padStart(2, '0')
          }}</span>
          <span class="service-name" :title="service.name">{{
            service.name
          }}</span>
          <strong>{{ service.count }}</strong>
        </div>
        <div class="service-track" aria-hidden="true">
          <i :style="{ width: (service.count / serviceMax) * 100 + '%' }"></i>
        </div>
      </li>
    </ol>

    <p v-else class="empty-state">暂无服务变更记录。</p>

    <p class="panel-note">按当前变更归属统计 · 显示前 5 项</p>

    <button class="panel-link" type="button" @click="emit('navigate', 'apps')">
      服务列表<TechIcon name="arrow" :size="14" />
    </button>
  </section>
</template>
