<script setup lang="ts">
defineProps<{
  rules: { code: string; title: string; count: number }[]
  available: boolean
}>()

const emit = defineEmits<{
  navigate: [target: string]
}>()
</script>

<template>
  <section class="instrument rules-panel">
    <header class="panel-heading">
      <h2>高频命中规则</h2>
      <span>03 / FINDINGS</span>
    </header>

    <ol v-if="available && rules.length" class="rule-list">
      <li
        v-for="(rule, index) in rules.slice(0, 4)"
        :key="rule.code"
      >
        <button type="button" @click="emit('navigate', 'risks')">
          <span class="rule-top">
            <span class="ordinal">{{
              String(index + 1).padStart(2, '0')
            }}</span>
            <span>{{ rule.count }} 次命中</span>
          </span>
          <strong :title="rule.title">{{ rule.title }}</strong>
          <small :title="rule.code">{{ rule.code }}</small>
        </button>
      </li>
    </ol>

    <p v-else class="empty-state">
      {{ available ? '当前变更暂无规则发现项。' : '等待变更数据读取。' }}
    </p>

    <p class="panel-note">
      统计当前变更的发现项，不代表仍在阻断；请查看具体检查结论。
    </p>
  </section>
</template>
