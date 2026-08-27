<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, useWorkspaceStore } from '@/stores/workspace'
import TechIcon from '@/components/TechIcon.vue'
import NeonButton from '@/components/NeonButton.vue'
import { APIError } from '@/api/client'
import { useTheme } from '@/composables/useTheme'

const theme = useTheme()
const auth = useAuthStore()
const ws = useWorkspaceStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const mode = ref<'login' | 'register' | 'invite'>('login')
const inviteCode = ref('')
const name = ref('')
const loading = ref(false)
const error = ref('')

const headline = computed(() =>
  mode.value === 'login' ? '进入控制台' : mode.value === 'register' ? '创建企业空间' : '接受邀请',
)
const actionLabel = computed(() =>
  mode.value === 'login' ? '进入系统' : mode.value === 'register' ? '创建并进入' : '加入工作空间',
)

const stages = [
  { label: '变更提交', state: 'done', meta: 'CHG-4821' },
  { label: '静态校验', state: 'done', meta: '12 项通过' },
  { label: '风险评级', state: 'risk', meta: 'HIGH · 索引重建' },
  { label: '独立审批', state: 'idle', meta: '等待复核' },
  { label: '进入生产', state: 'idle', meta: '门禁未放行' },
]

async function submit() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'login') {
      await auth.login(email.value, password.value)
    } else if (mode.value === 'register') {
      await auth.register({ name: name.value, email: email.value, password: password.value })
      await auth.login(email.value, password.value)
    } else {
      await auth.acceptInvite({ token: inviteCode.value, name: name.value, password: password.value })
    }
    await ws.load(true)
    router.push({ name: 'panorama' })
  } catch (e: any) {
    error.value = e instanceof APIError ? e.message : '操作失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <section class="aside">
      <div class="aside-grid" aria-hidden="true"></div>
      <div class="aside-wash" aria-hidden="true"></div>

      <header class="lockup">
        <span class="mark"><TechIcon name="shield" :size="17" /></span>
        <strong>ChangeGuard</strong>
        <span class="lockup-sep" aria-hidden="true"></span>
        <span class="lockup-sub mono">CHANGE RISK CONTROL</span>
      </header>

      <div class="copy">
        <h1>看见每一次<br>生产变更的风险。</h1>
        <p class="lede">高危节点会亮起来 · 过不了门禁就进不了生产</p>
      </div>

      <ol class="pipe" aria-label="变更门禁流程示意">
        <li v-for="s in stages" :key="s.label" :class="['pipe-step', s.state]">
          <span class="pipe-node" aria-hidden="true"></span>
          <span class="pipe-label">{{ s.label }}</span>
          <span class="pipe-meta mono">{{ s.meta }}</span>
        </li>
      </ol>

      <footer class="aside-foot mono">
        <span class="live" aria-hidden="true"></span>治理引擎在线
      </footer>
    </section>

    <section class="pane">
      <section class="card" aria-label="身份验证">
        <header class="brand">
          <div>
            <strong class="display">{{ headline }}</strong>
            <span>使用企业账号继续</span>
          </div>
          <button class="theme-switch" type="button" @click="theme.toggle()">
            <TechIcon :name="theme.isLight.value ? 'moon' : 'sun'" :size="15" />
          </button>
        </header>

        <div class="tabs" role="tablist">
          <button type="button" :class="{ on: mode === 'login' }" @click="mode = 'login'">登录</button>
          <button type="button" :class="{ on: mode === 'register' }" @click="mode = 'register'">注册</button>
          <button type="button" :class="{ on: mode === 'invite' }" @click="mode = 'invite'">邀请</button>
        </div>

        <form @submit.prevent="submit">
          <label v-if="mode === 'register' || mode === 'invite'">
            <span>姓名</span>
            <input v-model="name" type="text" placeholder="请输入姓名" autocomplete="name" />
          </label>
          <label v-if="mode === 'invite'">
            <span>邀请码</span>
            <input v-model="inviteCode" type="text" placeholder="输入邀请码" />
          </label>
          <label v-if="mode !== 'invite'">
            <span>企业邮箱</span>
            <input v-model="email" type="email" placeholder="name@company.com" autocomplete="email" required />
          </label>
          <label>
            <span>密码</span>
            <input v-model="password" type="password" placeholder="请输入密码" autocomplete="current-password" required />
          </label>
          <div v-if="error" class="err" role="alert">
            <TechIcon name="shield-alert" :size="15" />
            <span>{{ error }}</span>
          </div>
          <NeonButton type="submit" block :loading="loading" size="lg">{{ actionLabel }}</NeonButton>
        </form>

        <p class="fineprint">所有登录行为将被记录并纳入审计日志</p>
      </section>
    </section>
  </div>
</template>

<style scoped>
.login {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  background: var(--bg-void);
  overflow: hidden;
}

/* ── Left: product narrative, drawn entirely in CSS ─────────── */
.aside {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2.75rem;
  padding: 3rem clamp(2rem, 5vw, 5rem);
  min-width: 0;
  overflow: hidden;
  background: var(--bg-deep);
  border-right: 1px solid var(--line);
}
.aside-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(120% 90% at 30% 40%, #000 35%, transparent 100%);
  -webkit-mask-image: radial-gradient(120% 90% at 30% 40%, #000 35%, transparent 100%);
}
.aside-wash {
  position: absolute;
  inset: 0;
  background: radial-gradient(90% 70% at 18% 30%, var(--brand-soft) 0%, transparent 60%);
  pointer-events: none;
}

.lockup {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.mark {
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--r);
  color: var(--brand-bright);
  background: var(--brand-soft);
  border: 1px solid var(--line-bright);
}
.lockup strong {
  font-size: 1rem;
  color: var(--text-strong);
  font-weight: 650;
  letter-spacing: -0.01em;
}
.lockup-sep {
  width: 1px;
  height: 14px;
  background: var(--line-strong);
}
.lockup-sub {
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: var(--text-faint);
}

.copy { position: relative; max-width: 32rem; }
.copy h1 {
  font-size: clamp(2rem, 3.4vw, 3rem);
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text-strong);
}
.lede {
  margin-top: 1rem;
  color: var(--text-mute);
  font-size: 1rem;
  line-height: 1.6;
}

/* Governance pipeline: the product's core promise, made literal */
.pipe {
  position: relative;
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  border-left: 1px solid var(--line);
  padding-left: 1.4rem;
}
.pipe-step {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 0.5rem 1rem;
  padding: 0.72rem 0;
  border-bottom: 1px solid var(--line);
}
.pipe-step:last-child { border-bottom: none; }
.pipe-node {
  position: absolute;
  left: calc(-1.4rem - 4px);
  top: 1.02rem;
  width: 7px;
  height: 7px;
  border-radius: var(--r-xs);
  background: var(--bg-deep);
  border: 1px solid var(--text-faint);
}
.pipe-label { font-size: 0.92rem; color: var(--text-mute); }
.pipe-meta { font-size: 0.74rem; color: var(--text-faint); font-variant-numeric: tabular-nums; }

.pipe-step.done .pipe-node { background: var(--jade); border-color: var(--jade); }
.pipe-step.done .pipe-label { color: var(--text); }

.pipe-step.risk .pipe-node {
  background: var(--cinnabar);
  border-color: var(--cinnabar);
  box-shadow: 0 0 0 4px var(--cinnabar-soft);
}
.pipe-step.risk .pipe-label { color: var(--text-strong); font-weight: 600; }
.pipe-step.risk .pipe-meta { color: var(--cinnabar); }

.aside-foot {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.74rem;
  color: var(--text-faint);
}
.live {
  width: 6px;
  height: 6px;
  border-radius: var(--r-xs);
  background: var(--jade);
  box-shadow: 0 0 0 3px var(--jade-soft);
}

/* ── Right: the auth surface ────────────────────────────────── */
.pane {
  display: grid;
  place-items: center;
  padding: 2.5rem clamp(1.5rem, 4vw, 4rem);
  overflow-y: auto;
  background: var(--bg-void);
}
.card {
  width: 100%;
  max-width: 384px;
}

.brand {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.6rem;
}
.brand strong {
  display: block;
  font-size: 1.5rem;
  color: var(--text-strong);
  font-weight: 650;
  letter-spacing: -0.02em;
}
.brand > div > span {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.88rem;
  color: var(--text-mute);
}
.theme-switch {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r);
  color: var(--text-faint);
  border: 1px solid var(--line);
}
.theme-switch:hover { color: var(--brand-bright); border-color: var(--line-bright); }

.tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  margin-bottom: 1.5rem;
  border-radius: var(--r);
  background: var(--surface-2);
  border: 1px solid var(--line);
}
.tabs button {
  flex: 1;
  padding: 0.5rem 0.2rem;
  font-size: 0.86rem;
  border-radius: var(--r-sm);
  color: var(--text-mute);
  transition: color var(--dur), background var(--dur);
}
.tabs button:hover { color: var(--text); }
.tabs button.on {
  color: var(--text-strong);
  background: var(--bg-elev);
  box-shadow: var(--shadow-soft);
}

form { display: flex; flex-direction: column; gap: 1rem; }
label { display: flex; flex-direction: column; gap: 0.4rem; }
label span { font-size: 0.8rem; color: var(--text-mute); font-weight: 500; }
input {
  height: 42px;
  padding: 0 0.85rem;
  border-radius: var(--r);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  color: var(--text-strong);
  font-size: 0.92rem;
  outline: none;
  transition: border-color var(--dur), box-shadow var(--dur);
}
input::placeholder { color: var(--text-faint); }
input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

.err {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.84rem;
  color: var(--cinnabar);
  background: var(--cinnabar-soft);
  border: 1px solid var(--line);
  border-left: 2px solid var(--cinnabar);
  padding: 0.6rem 0.75rem;
  border-radius: var(--r-sm);
}
.err svg { flex: none; }

.fineprint {
  margin-top: 1.5rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--line);
  font-size: 0.75rem;
  color: var(--text-faint);
  line-height: 1.5;
}

@media (max-width: 960px) {
  .login {
    position: absolute;
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    overflow-y: auto;
  }
  .aside {
    gap: 1.75rem;
    padding: 2rem 1.5rem 2.25rem;
    border-right: none;
    border-bottom: 1px solid var(--line);
  }
  .copy h1 { font-size: 1.6rem; }
  .lede { font-size: 0.92rem; }
  .pipe { display: none; }
  .pane { padding: 2rem 1.5rem 3rem; place-items: start center; }
}
</style>
