<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/workspace'
import { api } from '@/api/client'
import TechIcon from '@/components/TechIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NeonButton from '@/components/NeonButton.vue'
import { useTheme, type ThemePref } from '@/composables/useTheme'

const ws = useWorkspaceStore()
const auth = useAuthStore()
const theme = useTheme()
const themeOpts: { k: ThemePref; label: string }[] = [
  { k: 'dark', label: '深色' },
  { k: 'light', label: '浅色' },
  { k: 'system', label: '跟随系统' },
]
const ent = ref<any>({})
const integrations = ref<any>(null)
const saving = ref(false)

async function load() {
  try { ent.value = await api.enterprise() } catch {}
  integrations.value = ws.data?.integrationStatus || {}
}
async function save() {
  if (!ent.value) return
  saving.value = true
  try { await api.updateEnterprise({ name: ent.value.name }); await load() } catch (e: any) { alert(e?.message || '保存失败') }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-kicker mono">SYSTEM</div>
        <div class="page-title">系统设置</div>
        <div class="page-sub">外观 · 企业信息 · 集成 · 账户</div>
      </div>
    </div>

    <div class="settings-grid">
      <article class="spanel">
        <h3><i></i>外观</h3>
        <p class="muted">界面配色会保存在本机，登录页与全景同步生效。</p>
        <div class="theme-seg">
          <button
            v-for="opt in themeOpts" :key="opt.k" type="button"
            :class="{ on: theme.pref.value === opt.k }"
            @click="theme.setPref(opt.k)"
          >{{ opt.label }}</button>
        </div>
      </article>

      <article class="spanel">
        <h3><i></i>企业信息</h3>
        <label class="sfield"><span>企业名称</span><input v-model="ent.name" placeholder="企业名称" /></label>
        <label class="sfield"><span>企业标识</span><span class="id-cell">{{ ent?.id || '—' }}</span></label>
        <label class="sfield"><span>角色</span><span>{{ auth.role }}</span></label>
        <NeonButton :loading="saving" @click="save"><TechIcon name="refresh" :size="15" /> 保存</NeonButton>
      </article>

      <article class="spanel">
        <h3><i></i>集成状态</h3>
        <div v-if="integrations && Object.keys(integrations).length" class="ints">
          <div v-for="(v, k) in integrations" :key="k" class="int-row">
            <span class="int-name">{{ k }}</span>
            <StatusBadge :type="'status'" :value="v === true || v?.enabled === true || v?.status === 'ok' ? 'OK' : 'PENDING'" size="sm">{{ typeof v === 'object' ? (v.status || '未知') : (v ? '已启用' : '未启用') }}</StatusBadge>
          </div>
        </div>
        <div v-else class="muted">暂无集成配置</div>
      </article>

      <article class="spanel">
        <h3><i></i>账户</h3>
        <div class="acct">
          <span class="acct-avatar">{{ (auth.user?.name || auth.user?.email || 'CG').slice(0, 2).toUpperCase() }}</span>
          <div><strong>{{ auth.user?.name || '操作员' }}</strong><br><span class="muted">{{ auth.user?.email || '—' }}</span></div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
@import './page.css';
/* 卡片按内容定高：页面级 flex 拉伸会把四张卡撑成等高，
   内容只占上半、下半留白，反而显得空。 */
.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--sp-3); align-content: start; align-items: start; }
.spanel { padding: var(--sp-4); border-radius: var(--r); background: var(--surface); border: 1px solid var(--line); display: flex; flex-direction: column; gap: var(--sp-3); }
.spanel h3 { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-14); color: var(--text-strong); font-weight: var(--fw-medium); }
.spanel h3 i { width: 2px; height: 14px; background: var(--gold); border-radius: 1px; }
.sfield { display: flex; flex-direction: column; gap: var(--sp-1); font-size: var(--fs-12); color: var(--text-mute); }
.sfield input { height: 32px; padding: 0 var(--sp-3); border-radius: var(--r); background: var(--bg-void); border: 1px solid var(--line); color: var(--text); outline: none; font-size: var(--fs-13); }
.sfield input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px var(--gold-soft); }
.ints { display: flex; flex-direction: column; gap: var(--sp-2); }
.int-row { display: flex; align-items: center; justify-content: space-between; min-height: 32px; padding: var(--sp-1) 0; border-bottom: 1px solid var(--line); font-size: var(--fs-13); }
.int-name { font-family: var(--font-mono); color: var(--text-mute); text-transform: capitalize; }
.acct { display: flex; align-items: center; gap: var(--sp-3); }
.acct-avatar { width: 44px; height: 44px; border-radius: var(--r); display: grid; place-items: center; background: var(--gold-soft); color: var(--gold-bright); font-weight: var(--fw-semibold); border: 1px solid var(--line-bright); }
.theme-seg { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; padding: 3px; border: 1px solid var(--line); border-radius: var(--r); background: var(--bg-glass); }
.theme-seg button { height: 28px; border-radius: var(--r-sm); font-size: var(--fs-12); color: var(--text-mute); }
.theme-seg button.on { background: var(--bg-elev); color: var(--text-strong); border: 1px solid var(--line); }
</style>
