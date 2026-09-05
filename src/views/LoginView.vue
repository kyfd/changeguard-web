<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore, useWorkspaceStore } from '@/stores/workspace'
import TechIcon from '@/components/TechIcon.vue'
import BrandLogo from '@/components/BrandLogo.vue'
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
const orgName = ref('')
const orgSlug = ref('')
const loading = ref(false)
const error = ref('')

const headline = computed(() =>
  mode.value === 'login' ? '进入控制台' : mode.value === 'register' ? '创建企业空间' : '接受邀请',
)
const actionLabel = computed(() =>
  mode.value === 'login' ? '进入系统' : mode.value === 'register' ? '创建并进入' : '加入工作空间',
)

const steps = [
  { label: '提交变更', meta: '记录内容与目标环境' },
  { label: '规则检查', meta: '查看命中规则与阻断项' },
  { label: '预发验证', meta: '核对执行与回滚证据' },
  { label: '独立审批', meta: '由审核人批准或拒绝' },
  { label: 'CI 消费通行证', meta: '校验发布内容与授权' },
]

async function submit() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'login') {
      await auth.login(email.value, password.value)
    } else if (mode.value === 'register') {
      await auth.register({
        organization_name: orgName.value.trim(),
        organization_slug: orgSlug.value.trim().toLowerCase(),
        name: name.value.trim(),
        email: email.value,
        password: password.value,
      })
      await auth.login(email.value, password.value)
    } else {
      await auth.acceptInvite({ token: inviteCode.value, name: name.value, password: password.value })
    }
    await ws.load(true)
    router.push({ name: 'dashboard' })
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
      <span class="cross" style="left: 12%; top: 18%" aria-hidden="true"></span>
      <span class="cross" style="left: 64%; top: 64%" aria-hidden="true"></span>
      <span class="cross" style="left: 38%; top: 86%" aria-hidden="true"></span>

      <header class="lockup">
        <span class="mark"><BrandLogo :size="20"  /></span>
        <strong>ChangeGuard</strong>
        <span class="lockup-sep" aria-hidden="true"></span>
        <span class="kicker">CHANGE RISK CONTROL</span>
      </header>

      <div class="copy">
        <h1>检查变更，<br>核对审批。</h1>
        <p>SQL、配置与 Kubernetes 发布前检查</p>
      </div>

      <ol class="pipe" aria-label="变更检查流程说明">
        <li v-for="s in steps" :key="s.label" class="pipe-step">
          <span class="pipe-node" aria-hidden="true"></span>
          <span class="pipe-label">{{ s.label }}</span>
          <span class="pipe-meta">{{ s.meta }}</span>
        </li>
      </ol>

      <footer class="aside-foot">通行证消费不代表部署成功，发布结果需另行核对。</footer>
    </section>

    <section class="pane">
      <section class="card" aria-label="身份验证">
        <header class="brand">
          <div>
            <strong class="display">{{ headline }}</strong>
            <span>使用企业账号继续</span>
          </div>
          <button class="theme-switch" type="button" :aria-label="theme.isLight.value ? '切换为深色' : '切换为浅色'" @click="theme.toggle()">
            <TechIcon :name="theme.isLight.value ? 'moon' : 'sun'" :size="15" />
          </button>
        </header>

        <div class="tabs" role="tablist">
          <button type="button" :class="{ on: mode === 'login' }" @click="mode = 'login'">登录</button>
          <button type="button" :class="{ on: mode === 'register' }" @click="mode = 'register'">注册</button>
          <button type="button" :class="{ on: mode === 'invite' }" @click="mode = 'invite'">邀请</button>
        </div>

        <form @submit.prevent="submit">
          <label v-if="mode === 'register'">
            <span>企业名称</span>
            <input v-model="orgName" type="text" placeholder="如：核心交易技术部" autocomplete="organization" maxlength="100" required />
          </label>
          <label v-if="mode === 'register'">
            <span>企业标识</span>
            <input
              v-model="orgSlug"
              type="text"
              class="mono"
              placeholder="小写字母 / 数字 / 连字符，如 acme-corp"
              pattern="[a-z0-9][a-z0-9-]{2,39}"
              maxlength="40"
              autocomplete="off"
              required
            />
          </label>
          <label v-if="mode === 'register' || mode === 'invite'">
            <span>姓名</span>
            <input v-model="name" type="text" placeholder="请输入姓名" autocomplete="name" required />
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

        <p class="fineprint">请使用所在工作空间的账号登录</p>
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
  background: var(--bg-base);
  border-right: 1px solid var(--line);
}
:root[data-theme="light"] .aside {
  background: linear-gradient(155deg, #fbfbfe 0%, var(--bg-base) 46%, var(--bg-base) 100%);
}
.aside-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(120% 90% at 30% 40%, #000 30%, transparent 100%);
  -webkit-mask-image: radial-gradient(120% 90% at 30% 40%, #000 30%, transparent 100%);
}
.aside-wash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(720px 480px at 16% 22%, var(--brand-soft) 0%, transparent 62%);
}
.cross { position: absolute; width: 13px; height: 13px; opacity: 0.9; }
.cross::before, .cross::after { content: ""; position: absolute; background: var(--line-strong); }
.cross::before { left: 6px; top: 0; width: 1px; height: 13px; }
.cross::after { left: 0; top: 6px; width: 13px; height: 1px; }

.lockup {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.mark {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--r-lg);
  color: var(--brand);
  background: var(--brand-soft);
  border: 1px solid var(--line-bright);
}
.lockup strong {
  font-size: 1.15rem;
  color: var(--text-strong);
  font-weight: 650;
  letter-spacing: -0.01em;
}
.lockup-sep {
  width: 1px;
  height: 14px;
  background: var(--line-strong);
}

.copy { position: relative; max-width: 32rem; }
.copy h1 {
  font-size: clamp(2.4rem, 3.9vw, 3.5rem);
  font-weight: 650;
  line-height: 1.22;
  letter-spacing: -0.02em;
  color: var(--text-strong);
}

.copy p { margin-top: 1rem; color: var(--text-mute); line-height: 1.6; }

/* 静态流程说明 */
.pipe {
  position: relative;
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 1.4rem;
}
/* 静态导轨 */
.pipe::before {
  content: "";
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--line);
  border-radius: 1px;
}
.pipe-step {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 0.5rem 1rem;
  padding: 0.72rem 0;
  border-bottom: 1px solid var(--line);
  transition: opacity 0.4s var(--ease);
}
.pipe-step:last-child { border-bottom: none; }

.pipe-node {
  position: absolute;
  left: calc(-1.4rem - 4px);
  top: 1.02rem;
  width: 8px;
  height: 8px;
  border-radius: var(--r-xs);
  background: var(--bg-base);
  border: 1px solid var(--text-faint);
  transition: background 0.3s var(--ease), border-color 0.3s var(--ease), box-shadow 0.3s var(--ease);
}
.pipe-label {
  font-size: 0.92rem;
  color: var(--text-mute);
  transition: color 0.3s var(--ease);
}
.pipe-meta {
  font-size: 0.74rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.aside-foot {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.74rem;
  color: var(--text-faint);
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
  max-width: 400px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-panel);
  padding: 32px;
}
:root[data-theme="light"] .card {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), var(--shadow-panel);
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
  border: 1px solid transparent;
  color: var(--text-mute);
  transition: color var(--dur), background var(--dur), box-shadow var(--dur);
}
.tabs button:hover { color: var(--text); }
.tabs button.on {
  color: var(--text-strong);
  background: var(--surface);
  border-color: var(--line);
  box-shadow: var(--shadow-soft);
}

form { display: flex; flex-direction: column; gap: 1rem; }
label { display: flex; flex-direction: column; gap: 0.4rem; }
label span { font-size: 13px; color: var(--text-mute); font-weight: 500; }
input {
  height: 44px;
  padding: 0 0.85rem;
  border-radius: var(--r);
  background: var(--surface-2);
  border: 1px solid var(--line-strong);
  color: var(--text-strong);
  font-size: 0.92rem;
  outline: none;
  transition: border-color var(--dur), box-shadow var(--dur), background var(--dur);
}
input::placeholder { color: var(--text-faint); }
input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
  background: var(--surface);
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
  .pipe { display: none; }
  .pane { padding: 2rem 1.5rem 3rem; place-items: start center; }
}
</style>
