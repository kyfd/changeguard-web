<script setup lang="ts">
import { ref } from 'vue'
import TechIcon from '@/components/TechIcon.vue'
import NeonButton from '@/components/NeonButton.vue'
import { fmtTime } from '@/lib/labels.ts'

const props = defineProps<{
  qaList: any[]
  asking: boolean
  userName?: string
}>()

const emit = defineEmits<{
  ask: [question: string]
}>()

const question = ref('')
const suggestions = [
  '这个变更会影响下游哪些服务？',
  '当前规则阻断项中哪些必须整改后才能批准？',
  'SQL 是否有锁表或全表扫描风险？',
]

function fmt(t?: string) {
  if (!t) return '—'
  const value = new Date(t)
  if (!Number.isFinite(value.getTime())) return '—'
  return fmtTime(t)
}

function initials(n?: string) {
  return (n || 'CG').slice(0, 2).toUpperCase()
}

function onSubmit() {
  const q = question.value.trim()
  if (!q || props.asking) return
  emit('ask', q)
  question.value = ''
}

function onPickSuggestion(s: string) {
  if (props.asking) return
  emit('ask', s)
}
</script>

<template>
  <div class="dpanel agent-panel">
    <div class="dpanel-head">
      <h3>
        <TechIcon name="activity" :size="16" />
        变更助手（可选）
      </h3>
      <span class="agent-badge">基于变更证据回答</span>
    </div>

    <!-- 问答流 -->
    <div class="agent-qa-list">
      <div v-if="!qaList.length" class="agent-placeholder">
        <TechIcon name="activity" :size="20" />
        <span>随时向助手提问，例如分析阻断原因、评估变更影响范围。</span>
      </div>

      <div
        v-for="m in qaList"
        :key="m.id"
        class="agent-qa-item"
        :class="{ 'is-pending': m.pending, 'is-error': m.error }"
      >
        <!-- 用户问题 -->
        <div class="agent-qa-q">
          <span class="avatar">{{ initials(userName) }}</span>
          <div class="q-content">
            <div class="comment-meta">
              <strong>{{ userName || '我' }}</strong>
              <span>{{ fmt(m.created_at) }}</span>
            </div>
            <p>{{ m.question }}</p>
          </div>
        </div>

        <!-- 助手回答 -->
        <div class="agent-qa-a">
          <div class="agent-qa-a-head">
            <strong>变更助手</strong>
            <span v-if="m.trace?.length">{{ m.trace.length }} 项证据</span>
          </div>

          <p v-if="!m.pending" class="answer-text">{{ m.answer }}</p>
          <div v-else class="agent-qa-thinking">
            <span class="agent-qa-dots"><i></i><i></i><i></i></span>
            正在读取变更证据…
          </div>

          <!-- 证据链 -->
          <div v-if="m.citations?.length" class="agent-qa-citations">
            <strong>证据链</strong>
            <div class="agent-citation-list">
              <button
                v-for="c in m.citations"
                :key="c.kind + c.id"
                type="button"
                class="agent-citation"
                :title="c.summary || ''"
              >
                <span class="agent-citation-kind">{{ c.kind }}</span>
                <span>{{ c.title || c.id }}</span>
                <code>{{ c.summary }}</code>
              </button>
            </div>
          </div>

          <!-- 工具轨迹 -->
          <div v-if="m.trace?.length" class="agent-tool-log">
            <strong>工具轨迹</strong>
            <code
              v-for="(t, i) in m.trace"
              :key="t.tool + i"
              :class="{ 'tool-error': t.error }"
            >
              {{ t.tool
              }}{{
                t.error
                  ? ' · 失败：' + t.error
                  : t.output
                    ? ' · ' + String(t.output).slice(0, 48)
                    : ''
              }}
            </code>
          </div>

          <!-- 建议下一步行动 -->
          <div v-if="m.proposals?.length" class="agent-proposals">
            <strong>建议下一步</strong>
            <span v-for="p in m.proposals" :key="p.type" class="proposal-chip">
              {{ p.title || p.type }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 提问与建议 -->
    <form class="agent-qa-form" @submit.prevent="onSubmit">
      <div class="agent-qa-suggestions">
        <button
          v-for="s in suggestions"
          :key="s"
          type="button"
          class="chip"
          :disabled="asking"
          @click="onPickSuggestion(s)"
        >
          {{ s }}
        </button>
      </div>

      <div class="input-area">
        <textarea
          v-model="question"
          rows="2"
          maxlength="1000"
          placeholder="向变更助手提问，例如：为什么不能审批？怎么整改？"
          @keydown.enter.exact.prevent="onSubmit"
        ></textarea>
      </div>

      <div class="agent-qa-foot">
        <span>回答仅供参考，不代替规则检查与人工审批（Enter 发送）</span>
        <NeonButton type="submit" size="sm" :loading="asking">
          <TechIcon name="activity" :size="14" /> 提问
        </NeonButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.dpanel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xl);
  padding: var(--sp-5);
  margin-bottom: var(--sp-5);
}

.dpanel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-4);
}

.dpanel-head h3 {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0;
  font-size: var(--fs-16);
  font-weight: var(--fw-semibold);
  color: var(--text-strong);
}

.agent-badge {
  font-size: var(--fs-11);
  color: var(--brand);
  background: var(--brand-soft);
  padding: 2px 8px;
  border-radius: var(--r-pill);
}

.agent-qa-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-height: 480px;
  overflow-y: auto;
  padding-right: var(--sp-2);
  margin-bottom: var(--sp-4);
}

.agent-placeholder {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-4);
  background: var(--surface-2);
  border-radius: var(--r);
  color: var(--text-mute);
  font-size: var(--fs-13);
}

.agent-qa-item {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-3);
  background: var(--surface-2);
  border-radius: var(--r);
  border: 1px solid var(--line);
}

.agent-qa-q {
  display: flex;
  gap: var(--sp-3);
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--brand);
  color: #fff;
  font-size: var(--fs-11);
  font-weight: var(--fw-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.q-content {
  flex: 1;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-11);
  color: var(--text-faint);
  margin-bottom: 2px;
}

.comment-meta strong {
  color: var(--text-strong);
}

.agent-qa-q p {
  margin: 0;
  font-size: var(--fs-13);
  color: var(--text-strong);
}

.agent-qa-a {
  background: var(--surface);
  border-radius: var(--r-sm);
  padding: var(--sp-3);
  border: 1px solid var(--line);
}

.agent-qa-a-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-11);
  color: var(--text-mute);
  margin-bottom: var(--sp-2);
}

.answer-text {
  margin: 0;
  font-size: var(--fs-13);
  color: var(--text);
  line-height: var(--lh-base);
  white-space: pre-wrap;
}

.agent-qa-thinking {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-12);
  color: var(--text-mute);
}

.agent-qa-dots i {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--brand);
  margin: 0 1px;
  animation: bounce 1.2s infinite ease-in-out;
}

.agent-qa-citations,
.agent-tool-log,
.agent-proposals {
  margin-top: var(--sp-3);
  padding-top: var(--sp-2);
  border-top: 1px dashed var(--line);
  font-size: var(--fs-11);
}

.agent-qa-citations strong,
.agent-tool-log strong,
.agent-proposals strong {
  display: block;
  margin-bottom: var(--sp-1);
  color: var(--text-mute);
}

.agent-citation-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.agent-citation {
  background: var(--surface-2);
  border: 1px solid var(--line);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  font-size: var(--fs-11);
  color: var(--text);
  cursor: pointer;
}

.agent-citation-kind {
  color: var(--brand);
  margin-right: 4px;
}

.agent-tool-log code {
  display: block;
  font-family: var(--font-mono);
  color: var(--text-faint);
  margin-top: 2px;
}

.proposal-chip {
  display: inline-block;
  background: var(--brand-soft);
  color: var(--brand);
  padding: 1px 6px;
  border-radius: var(--r-xs);
  margin-right: 4px;
}

.agent-qa-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}

.chip {
  background: var(--surface-2);
  border: 1px solid var(--line);
  padding: 3px 8px;
  border-radius: var(--r-pill);
  font-size: var(--fs-11);
  color: var(--text-mute);
  cursor: pointer;
  transition: all var(--dur-fast);
}

.chip:hover:not(:disabled) {
  border-color: var(--brand);
  color: var(--brand);
  background: var(--brand-soft);
}

.input-area textarea {
  width: 100%;
  padding: var(--sp-3);
  border-radius: var(--r);
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--text-strong);
  font-family: inherit;
  font-size: var(--fs-13);
  outline: none;
  resize: vertical;
  transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
}

.input-area textarea:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.agent-qa-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--sp-2);
  font-size: var(--fs-11);
  color: var(--text-faint);
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
