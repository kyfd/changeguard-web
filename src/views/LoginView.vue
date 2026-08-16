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
    <div class="field-photo" aria-hidden="true"></div>
    <div class="field-veil" aria-hidden="true"></div>
    <div class="copy">
      <p class="eyebrow">CHANGE RISK CONTROL</p>
      <h1>看见每一次<br>生产变更的风险。</h1>
      <p class="lede">高危节点会亮起来 · 过不了门禁就进不了生产</p>
    </div>

    <section class="card" aria-label="身份验证">
      <header class="brand">
        <span class="mark"><TechIcon name="shield" :size="18" /></span>
        <div>
          <strong class="display">ChangeGuard</strong>
          <span>企业变更风险治理</span>
        </div>
      </header>

      <div class="tabs" role="tablist">
        <button type="button" :class="{ on: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button type="button" :class="{ on: mode === 'register' }" @click="mode = 'register'">注册</button>
        <button type="button" :class="{ on: mode === 'invite' }" @click="mode = 'invite'">邀请</button>
      </div>

      <h2>{{ headline }}</h2>

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
        <div v-if="error" class="err" role="alert">{{ error }}</div>
        <NeonButton type="submit" block :loading="loading" size="lg">{{ actionLabel }}</NeonButton>
      </form>

      <button class="theme-switch" type="button" @click="theme.toggle()">
        {{ theme.isLight.value ? '深色模式' : '浅色模式' }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.login {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #05070c;
}
.field-photo {
  position: absolute;
  inset: 0;
  background: url("../assets/images/deck.jpg") center / cover no-repeat;
  transform: scale(1.04);
  animation: drift 28s ease-in-out infinite alternate;
}
.field-veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(5, 7, 12, 0.28) 0%, rgba(5, 7, 12, 0.18) 48%, rgba(5, 7, 12, 0.72) 100%),
    linear-gradient(180deg, rgba(5, 7, 12, 0.18) 0%, rgba(5, 7, 12, 0.48) 100%);
}

.copy {
  position: absolute;
  left: 4.2vw;
  bottom: 8vh;
  z-index: 2;
  max-width: 28rem;
  animation: float-up 0.7s var(--ease-out) both;
}
.eyebrow {
  font-family: var(--font-brand);
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  color: var(--brand);
  margin-bottom: 0.85rem;
}
.copy h1 {
  font-size: clamp(2.1rem, 4.2vw, 3.4rem);
  font-weight: 650;
  line-height: 1.18;
  color: #f3fbff;
  text-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
.lede {
  margin-top: 0.9rem;
  color: rgba(215, 230, 238, 0.78);
  font-size: 1rem;
}

.card {
  position: absolute;
  top: 50%;
  right: max(3.2vw, 1.6rem);
  transform: translateY(-50%);
  z-index: 3;
  width: min(400px, 92vw);
  padding: 1.7rem 1.65rem 1.35rem;
  border-radius: 18px;
  background: rgba(8, 14, 22, 0.62);
  border: 1px solid rgba(122, 240, 228, 0.22);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  animation: float-up 0.7s 0.08s var(--ease-out) both;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--brand-bright);
  background: var(--brand-soft);
  border: 1px solid var(--line-bright);
  box-shadow: var(--glow-cyan);
}
.brand strong {
  display: block;
  font-size: 1.08rem;
  color: #fff;
}
.brand span { font-size: 0.74rem; color: var(--text-faint); }

.tabs {
  display: flex;
  border-bottom: 1px solid var(--line);
  margin-bottom: 1.1rem;
}
.tabs button {
  flex: 1;
  padding: 0.62rem 0.2rem 0.7rem;
  font-size: 0.88rem;
  color: var(--text-mute);
  position: relative;
}
.tabs button.on { color: #fff; }
.tabs button.on::after {
  content: "";
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: -1px;
  height: 2px;
  background: var(--brand);
  box-shadow: 0 0 12px rgba(62, 224, 208, 0.7);
}
.card h2 {
  font-size: 1.12rem;
  margin-bottom: 0.95rem;
  color: #fff;
}
form { display: flex; flex-direction: column; gap: 0.85rem; }
label { display: flex; flex-direction: column; gap: 0.35rem; }
label span { font-size: 0.78rem; color: var(--text-mute); }
input {
  height: 44px;
  padding: 0 0.9rem;
  border-radius: 10px;
  background: rgba(4, 8, 14, 0.55);
  border: 1px solid var(--line);
  color: #fff;
  outline: none;
}
input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft), var(--glow-cyan);
}
.err {
  font-size: 0.8rem;
  color: var(--amber);
  background: var(--amber-soft);
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
}
.theme-switch {
  margin-top: 0.95rem;
  font-size: 0.74rem;
  color: var(--text-faint);
}
.theme-switch:hover { color: var(--brand-bright); }

@keyframes drift {
  from { transform: scale(1.04) translate3d(0, 0, 0); }
  to { transform: scale(1.08) translate3d(-1.2%, -0.6%, 0); }
}

@media (max-width: 860px) {
  .copy { left: 1.2rem; right: 1.2rem; bottom: auto; top: 1.2rem; max-width: none; }
  .copy h1 { font-size: 1.45rem; }
  .card {
    top: auto;
    bottom: 0;
    right: 0;
    left: 0;
    transform: none;
    width: 100%;
    border-radius: 18px 18px 0 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .field-photo { animation: none; }
}
</style>
