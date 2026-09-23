<script setup lang="ts">
/* 企业模型接入：管理员选择服务商预设或自定义 OpenAI 兼容 / Anthropic 端点。
   API Key 只写不读：后端只回传 api_key_hint；留空保存表示沿用已保存的 Key。 */
import { ref, computed, onMounted } from 'vue'
import { api } from '@/api/client'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'

const props = defineProps<{ isAdmin: boolean }>()

type Preset = { id: string; name: string; provider: string; base_url: string; model: string; hint?: string }
const EXTRA_PRESETS: Preset[] = [
  { id: 'volcengine', name: '火山方舟', provider: 'openai_compatible', base_url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', model: '', hint: '填写方舟推理接入点或模型 ID；地址需带 /chat/completions' },
  { id: 'dashscope', name: '通义千问', provider: 'openai_compatible', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', hint: 'DashScope OpenAI 兼容模式' },
  { id: 'custom', name: '自定义', provider: 'openai_compatible', base_url: '', model: '', hint: '任意 OpenAI 兼容端点（需公网可达）' },
]

const presets = ref<Preset[]>([])
const cfg = ref<any>(null)
const usage = ref<any>(null)
const loadError = ref('')

const form = ref({ preset: 'custom', enabled: true, provider: 'openai_compatible', base_url: '', model: '', max_tokens: 3000, api_key: '' })
const showKey = ref(false)
const models = ref<string[]>([])
const busy = ref<'' | 'test' | 'models' | 'save' | 'disable'>('')
const notice = ref<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null)

const connected = computed(() => cfg.value?.source === 'organization' && cfg.value?.enabled)
const activePreset = computed(() => presets.value.find(p => p.id === form.value.preset))
const isAnthropic = computed(() => form.value.provider === 'anthropic')
const canSubmit = computed(() => props.isAdmin && form.value.base_url.trim() && form.value.model.trim() && !busy.value)

function detectPreset(baseURL: string) {
  const hit = presets.value.find(p => p.base_url && p.id !== 'custom' && baseURL.startsWith(p.base_url.replace(/\/chat\/completions$/, '')))
  return hit?.id || 'custom'
}

async function load() {
  loadError.value = ''
  const [serverPresets, config, u] = await Promise.all([api.llmPresets(), api.llmConfig().catch((e: any) => { loadError.value = e?.message || '读取失败'; return null }), api.llmUsage()])
  const merged = [...(Array.isArray(serverPresets) ? serverPresets : []), ...EXTRA_PRESETS]
  presets.value = merged.filter((p, i) => merged.findIndex(q => q.id === p.id) === i)
  cfg.value = config
  usage.value = u
  if (config) {
    form.value.enabled = config.enabled !== false || !config.base_url
    form.value.provider = config.provider || 'openai_compatible'
    form.value.base_url = config.base_url || ''
    form.value.model = config.model || ''
    form.value.max_tokens = config.max_tokens || 3000
    form.value.preset = config.base_url ? detectPreset(config.base_url) : 'deepseek'
    if (!config.base_url) applyPreset(form.value.preset)
  }
}

function applyPreset(id: string) {
  const p = presets.value.find(x => x.id === id)
  form.value.preset = id
  models.value = []
  notice.value = null
  if (!p) return
  form.value.provider = p.provider || 'openai_compatible'
  if (p.base_url || id === 'custom') form.value.base_url = p.base_url
  if (p.model || id === 'custom') form.value.model = p.model
}

function payloadBase() {
  return { provider: form.value.provider, base_url: form.value.base_url.trim(), model: form.value.model.trim(), max_tokens: Number(form.value.max_tokens) || 0, api_key: form.value.api_key.trim() }
}

async function testConn() {
  busy.value = 'test'; notice.value = null
  try {
    const r = await api.testLLM(payloadBase())
    notice.value = r?.ok ? { tone: 'ok', text: r.message || '连接正常' } : { tone: 'err', text: r?.message || '连接失败' }
  } catch (e: any) { notice.value = { tone: 'err', text: e?.message || '连接失败' } }
  finally { busy.value = '' }
}

async function fetchModels() {
  busy.value = 'models'; notice.value = null
  try {
    const r = await api.listLLMModels(payloadBase())
    models.value = (r?.models || []).map((m: any) => (typeof m === 'string' ? m : m?.id || m?.name)).filter(Boolean)
    notice.value = { tone: 'info', text: models.value.length ? `获取到 ${models.value.length} 个模型，可直接选择` : '上游未返回模型，请手动填写模型名' }
  } catch (e: any) { notice.value = { tone: 'err', text: e?.message || '获取模型列表失败' } }
  finally { busy.value = '' }
}

async function save(enabled = true) {
  busy.value = enabled ? 'save' : 'disable'; notice.value = null
  try {
    cfg.value = await api.saveLLMConfig({ ...payloadBase(), enabled })
    form.value.api_key = ''
    form.value.enabled = enabled
    notice.value = { tone: 'ok', text: enabled ? '已保存并通过连通性检测，新提交的变更将使用该模型分析' : '已关闭企业模型，分析将使用本地规则归纳' }
  } catch (e: any) { notice.value = { tone: 'err', text: e?.message || '保存失败' } }
  finally { busy.value = '' }
}

function fmt(iso?: string) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(iso))
}
const usagePct = computed(() => {
  const u = usage.value
  if (!u?.org_limit) return 0
  return Math.min(100, Math.round((u.org_used / u.org_limit) * 100))
})

onMounted(load)
</script>

<template>
  <section class="wide-panel llm">
    <header>
      <h3><i></i>模型接入</h3>
      <StatusBadge type="status" :value="connected ? 'OK' : 'PENDING'" size="sm">{{ connected ? '已接入企业模型' : '未接入 · 使用规则归纳' }}</StatusBadge>
      <span class="muted small">用于变更单的风险解读与整改建议；模型只读取证据，不参与审批与发布。</span>
    </header>

    <p v-if="loadError" class="notice err">{{ loadError }}</p>

    <div class="llm-grid">
      <!-- 左：当前状态 -->
      <div class="llm-status">
        <div class="kv"><span>服务地址</span><code class="mono ellipsis" :title="cfg?.base_url">{{ cfg?.base_url || '—' }}</code></div>
        <div class="kv"><span>模型</span><span class="mono">{{ cfg?.model || '—' }}</span></div>
        <div class="kv"><span>API Key</span><span class="mono">{{ cfg?.has_api_key ? cfg.api_key_hint : '未保存' }}</span></div>
        <div class="kv"><span>最近更新</span><span class="mono">{{ fmt(cfg?.updated_at) }}</span></div>
        <div v-if="usage" class="usage">
          <div class="kv"><span>今日用量</span><span class="mono">企业 {{ usage.org_used }}/{{ usage.org_limit }} · 我 {{ usage.user_used }}/{{ usage.user_limit }}</span></div>
          <div class="meter"><i :style="{ width: usagePct + '%' }"></i></div>
        </div>
        <p v-if="cfg?.message" class="muted small">{{ cfg.message }}</p>
      </div>

      <!-- 右：配置表单 -->
      <form class="llm-form" @submit.prevent="save(true)">
        <fieldset :disabled="!isAdmin">
          <div class="preset-row" role="radiogroup" aria-label="服务商">
            <button
              v-for="p in presets" :key="p.id" type="button" role="radio"
              :aria-checked="form.preset === p.id" :class="{ on: form.preset === p.id }"
              @click="applyPreset(p.id)"
            >{{ p.name }}</button>
          </div>
          <p v-if="activePreset?.hint" class="muted small hint">{{ activePreset.hint }}</p>

          <div class="row2">
            <label class="sfield"><span>接口形态</span>
              <select v-model="form.provider">
                <option value="openai_compatible">OpenAI 兼容（/chat/completions）</option>
                <option value="anthropic">Anthropic Messages</option>
              </select>
            </label>
            <label class="sfield"><span>最大输出 Token</span>
              <input v-model.number="form.max_tokens" type="number" min="100" max="8000" step="100" />
            </label>
          </div>

          <label class="sfield"><span>服务地址</span>
            <input v-model="form.base_url" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false" />
          </label>

          <label class="sfield"><span>API Key<em v-if="cfg?.has_api_key">留空则沿用已保存的 {{ cfg.api_key_hint }}</em></span>
            <span class="key-wrap">
              <input v-model="form.api_key" :type="showKey ? 'text' : 'password'" :placeholder="cfg?.has_api_key ? '••••••••（不修改请留空）' : 'sk-...'" autocomplete="new-password" spellcheck="false" />
              <button type="button" class="eye" :aria-label="showKey ? '隐藏' : '显示'" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
            </span>
          </label>

          <label class="sfield"><span>模型</span>
            <span class="model-wrap">
              <input v-model="form.model" list="llm-model-options" placeholder="例如 deepseek-chat" autocomplete="off" spellcheck="false" />
              <datalist id="llm-model-options"><option v-for="m in models" :key="m" :value="m" /></datalist>
              <NeonButton type="button" variant="ghost" size="sm" :loading="busy === 'models'" :disabled="isAnthropic || !form.base_url" @click="fetchModels">获取列表</NeonButton>
            </span>
          </label>

          <p v-if="notice" class="notice" :class="notice.tone" role="status">{{ notice.text }}</p>

          <div class="actions">
            <NeonButton type="button" variant="ghost" :loading="busy === 'test'" :disabled="!canSubmit" @click="testConn"><TechIcon name="activity" :size="15" /> 测试连接</NeonButton>
            <NeonButton type="submit" :loading="busy === 'save'" :disabled="!canSubmit"><TechIcon name="check-circle" :size="15" /> 保存并启用</NeonButton>
            <NeonButton v-if="connected" type="button" variant="ghost" :loading="busy === 'disable'" :disabled="!isAdmin || !!busy" @click="save(false)">关闭</NeonButton>
          </div>
        </fieldset>
        <p v-if="!isAdmin" class="muted small">只有企业管理员可以修改模型接入。</p>
      </form>
    </div>
  </section>
</template>

<style scoped>
.wide-panel { min-width: 0; overflow: hidden; margin-bottom: var(--sp-3); padding: var(--sp-4); border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); }
.wide-panel > header { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-4); }
.wide-panel h3 { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-14); color: var(--text-strong); font-weight: var(--fw-semibold); }
.wide-panel h3 i { width: 2px; height: 14px; background: var(--brand); border-radius: 1px; }
.muted { color: var(--text-faint); }
.muted.small { font-size: var(--fs-12); }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.llm-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr); gap: var(--sp-4); }
.llm-form { min-width: 0; }
.llm-status { min-width: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r); background: var(--surface-2); align-self: start; }
.kv { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); font-size: var(--fs-12); min-width: 0; }
.kv > span:last-child { min-width: 0; overflow-wrap: anywhere; text-align: right; }
.kv > span:first-child { color: var(--text-mute); flex: none; }
.kv code { color: var(--text-strong); min-width: 0; flex: 1; text-align: right; }
.usage { display: flex; flex-direction: column; gap: 6px; padding-top: var(--sp-2); border-top: 1px dashed var(--line); }
.meter { height: 6px; border-radius: 999px; background: var(--line); overflow: hidden; }
.meter i { display: block; height: 100%; background: var(--brand); border-radius: inherit; transition: width var(--dur-fast); }

.llm-form fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
.llm-form fieldset:disabled { opacity: .7; }
.preset-row { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.preset-row button { height: 30px; padding: 0 12px; border-radius: var(--r); border: 1px solid var(--line-strong); background: var(--surface); color: var(--text-mute); font-size: var(--fs-12); transition: all var(--dur-fast); }
.preset-row button:hover { color: var(--text-strong); border-color: var(--line-bright); }
.preset-row button.on { color: var(--brand); border-color: var(--brand); background: var(--brand-soft); font-weight: var(--fw-medium); }
.preset-row button:focus-visible, .eye:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.hint { margin-top: -6px; }
.row2 { display: grid; grid-template-columns: 1fr 160px; gap: var(--sp-3); }
.sfield { display: flex; flex-direction: column; gap: var(--sp-1); font-size: var(--fs-12); color: var(--text-mute); min-width: 0; }
.sfield em { font-style: normal; margin-left: 8px; color: var(--text-faint); }
.sfield input, .sfield select { height: 32px; width: 100%; padding: 0 var(--sp-3); border-radius: var(--r); background: var(--surface-2); border: 1px solid var(--line-strong); color: var(--text-strong); outline: none; font-size: var(--fs-13); min-width: 0; }
.sfield input:focus, .sfield select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); background: var(--surface); }
.key-wrap, .model-wrap { display: flex; gap: var(--sp-2); align-items: center; }
.key-wrap input, .model-wrap input { flex: 1; font-family: var(--font-mono); }
.eye { flex: none; height: 32px; padding: 0 10px; border-radius: var(--r); border: 1px solid var(--line-strong); background: var(--surface); color: var(--text-mute); font-size: var(--fs-12); }
.notice { margin: 0; padding: 8px 12px; border-radius: var(--r); font-size: var(--fs-12); line-height: 1.5; border: 1px solid var(--line); word-break: break-all; }
.notice.ok { color: var(--jade); background: var(--jade-soft); border-color: color-mix(in srgb, var(--jade) 30%, transparent); }
.notice.err { color: var(--cinnabar); background: var(--cinnabar-soft); border-color: color-mix(in srgb, var(--cinnabar) 30%, transparent); }
.notice.info { color: var(--brand); background: var(--brand-soft); border-color: var(--line-bright); }
.actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

@media (max-width: 1100px) {
  .llm-grid { grid-template-columns: 1fr; }
  .row2 { grid-template-columns: 1fr; }
}
</style>
