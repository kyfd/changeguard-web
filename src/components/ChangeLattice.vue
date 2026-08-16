<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  interactive?: boolean
  expand?: boolean
  values?: Record<string, number | string>
  hot?: string[]
  satellites?: { id: string; label: string; value?: number | string }[]
}>(), { interactive: false, expand: false, values: () => ({}), hot: () => [], satellites: () => [] })

const emit = defineEmits<{ select: [id: string] }>()

type NodeDef = {
  id: string
  label: string
  ring: number
  a0: number
  latin?: boolean
  route?: string
}

const CORE: NodeDef[] = [
  { id: 'rule', label: '规则', ring: 0, a0: -0.4, route: 'policies' },
  { id: 'verify', label: '验证', ring: 0, a0: 1.7, route: 'risks' },
  { id: 'approve', label: '审批', ring: 0, a0: 3.8, route: 'approvals' },
  { id: 'audit', label: '审计', ring: 1, a0: 0.35, route: 'audits' },
  { id: 'rollback', label: '回滚', ring: 1, a0: 1.9, route: 'changes' },
  { id: 'svc', label: '服务', ring: 1, a0: 3.5, route: 'apps' },
  { id: 'evidence', label: '证据', ring: 1, a0: 5.1, route: 'audits' },
  { id: 'sql', label: 'SQL', ring: 2, a0: 0.15, latin: true, route: 'risks' },
  { id: 'k8s', label: 'K8s', ring: 2, a0: 1.2, latin: true, route: 'apps' },
  { id: 'cfg', label: '配置', ring: 2, a0: 2.25, route: 'policies' },
  { id: 'api', label: 'API', ring: 2, a0: 3.3, latin: true, route: 'changes' },
  { id: 'gate', label: '门禁', ring: 2, a0: 4.35, route: 'approvals' },
  { id: 'pass', label: '通行证', ring: 2, a0: 5.4, route: 'changes' },
]

const EDGES: [string, string][] = [
  ['rule', 'verify'], ['verify', 'approve'], ['approve', 'audit'],
  ['approve', 'rollback'], ['sql', 'verify'], ['k8s', 'svc'],
  ['cfg', 'rule'], ['api', 'svc'], ['gate', 'approve'],
  ['pass', 'approve'], ['evidence', 'audit'],
]

const PULSE: string[] = ['sql', 'verify', 'approve', 'gate']
const PERIODS = [0.045, 0.032, 0.022, 0.014]

const lastPlaced = new Map<string, { x: number; y: number; n: NodeDef }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let w = 0
let h = 0
let dpr = 1
let mx = 0.5
let my = 0.5
let tx = 0.5
let ty = 0.5
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const dust: { x: number; y: number; r: number; a: number; p: number }[] = []

function nodesNow(): NodeDef[] {
  const extra: NodeDef[] = (props.satellites || []).slice(0, 8).map((s, i) => ({
    id: s.id,
    label: s.label,
    ring: 3,
    a0: (i / Math.max(1, Math.min(8, props.satellites.length))) * Math.PI * 2 + 0.2,
    route: 'apps',
  }))
  return extra.length ? [...CORE, ...extra] : [
    ...CORE,
    { id: 'sat-a', label: '预发', ring: 3, a0: 0.4, route: 'risks' },
    { id: 'sat-b', label: '灰度', ring: 3, a0: 1.6, route: 'changes' },
    { id: 'sat-c', label: '生产', ring: 3, a0: 2.8, route: 'approvals' },
    { id: 'sat-d', label: '回放', ring: 3, a0: 4.0, route: 'audits' },
    { id: 'sat-e', label: '下游', ring: 3, a0: 5.2, route: 'apps' },
  ]
}

function seedDust() {
  dust.length = 0
  const n = Math.max(40, Math.min(120, Math.floor((w * h) / 18000)))
  for (let i = 0; i < n; i++) {
    dust.push({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.2,
      a: 0.08 + Math.random() * 0.28,
      p: Math.random() * Math.PI * 2,
    })
  }
}

function resize() {
  if (!canvas.value) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = canvas.value.clientWidth
  h = canvas.value.clientHeight
  canvas.value.width = Math.floor(w * dpr)
  canvas.value.height = Math.floor(h * dpr)
  ctx = canvas.value.getContext('2d', { alpha: true })
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  seedDust()
}

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
function hexRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '').trim()
  if (raw.length === 3) return [parseInt(raw[0] + raw[0], 16), parseInt(raw[1] + raw[1], 16), parseInt(raw[2] + raw[2], 16)]
  if (raw.length >= 6) return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)]
  return [62, 224, 208]
}

function posOf(n: NodeDef, t: number, cx: number, cy: number, rx: number, ry: number) {
  const ang = n.a0 + (reduced ? 0 : t * PERIODS[Math.min(n.ring, PERIODS.length - 1)])
  const m = props.expand ? [0.20, 0.40, 0.64, 0.90] : [0.22, 0.38, 0.56, 0.74]
  const k = m[n.ring] ?? 0.9
  return { x: cx + Math.cos(ang) * rx * k, y: cy + Math.sin(ang) * ry * k, n }
}

function drawAperture(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, ir: number, ig: number, ib: number) {
  const breath = reduced ? 1 : 0.96 + Math.sin(t * 0.7) * 0.04
  const R = r * breath
  c.save()
  c.translate(x, y)
  const bloom = c.createRadialGradient(0, 0, 0, 0, 0, R * 4.2)
  bloom.addColorStop(0, `rgba(${ir},${ig},${ib},0.48)`)
  bloom.addColorStop(0.35, `rgba(${ir},${ig},${ib},0.16)`)
  bloom.addColorStop(1, `rgba(${ir},${ig},${ib},0)`)
  c.fillStyle = bloom
  c.beginPath()
  c.arc(0, 0, R * 4.2, 0, Math.PI * 2)
  c.fill()
  for (let i = 0; i < 3; i++) {
    c.beginPath()
    c.arc(0, 0, R * (0.55 + i * 0.24), 0, Math.PI * 2)
    c.strokeStyle = `rgba(${ir},${ig},${ib},${0.55 - i * 0.12})`
    c.lineWidth = i === 0 ? 1.8 : 1.1
    c.stroke()
  }
  const core = c.createRadialGradient(-R * 0.12, -R * 0.14, 0, 0, 0, R * 0.38)
  core.addColorStop(0, 'rgba(243,251,255,0.95)')
  core.addColorStop(0.4, `rgba(${ir},${ig},${ib},0.55)`)
  core.addColorStop(1, `rgba(${ir},${ig},${ib},0.04)`)
  c.fillStyle = core
  c.beginPath()
  c.arc(0, 0, R * 0.34, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

function frame(now: number) {
  if (!ctx) return
  const t = now * 0.001
  const lerp = reduced ? 1 : 0.05
  tx += (mx - tx) * lerp
  ty += (my - ty) * lerp
  const px = (tx - 0.5) * (props.expand ? 28 : 14)
  const py = (ty - 0.5) * (props.expand ? 20 : 10)

  ctx.clearRect(0, 0, w, h)

  const [ir, ig, ib] = hexRgb(cssVar('--brand', '#3ee0d0'))
  const [tr, tg, tb] = hexRgb(cssVar('--text', '#d7e6ee'))
  const [ar, ag, ab] = hexRgb(cssVar('--amber', '#f0b429'))
  const ice = (a: number) => `rgba(${ir},${ig},${ib},${a})`
  const ink = (a: number) => `rgba(${tr},${tg},${tb},${a})`
  const amb = (a: number) => `rgba(${ar},${ag},${ab},${a})`

  const cx = w * 0.5 + px
  const cy = h * (props.expand ? 0.52 : 0.46) + py
  const rx = props.expand ? w * 0.48 : Math.min(w, h) * 0.42
  const ry = props.expand ? h * 0.44 : Math.min(w, h) * 0.38
  const list = nodesNow()

  for (const d of dust) {
    const dx = d.x * w + px * 0.4
    const dy = d.y * h + py * 0.4
    const tw = reduced ? d.a : d.a * (0.65 + Math.sin(t * 0.7 + d.p) * 0.35)
    ctx.beginPath()
    ctx.fillStyle = ink(tw)
    ctx.arc(dx, dy, d.r, 0, Math.PI * 2)
    ctx.fill()
  }

  const rings = 4
  for (let i = 0; i < rings; i++) {
    const k = props.expand ? [0.20, 0.40, 0.64, 0.90][i] : [0.22, 0.38, 0.56, 0.74][i]
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2)
    ctx.strokeStyle = ice(0.38 - i * 0.05)
    ctx.lineWidth = i === rings - 1 ? 1.6 : 1.15
    ctx.setLineDash(i % 2 ? [3, 8] : [])
    ctx.stroke()
    ctx.setLineDash([])
  }

  const placed = new Map<string, { x: number; y: number; n: NodeDef }>()
  for (const n of list) placed.set(n.id, posOf(n, t, cx, cy, rx, ry))

  for (const n of list) {
    const p = placed.get(n.id)!
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(p.x, p.y)
    ctx.strokeStyle = ice(n.ring >= 2 ? 0.18 : 0.28)
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  for (const [a, b] of EDGES) {
    const pa = placed.get(a)
    const pb = placed.get(b)
    if (!pa || !pb) continue
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.strokeStyle = ice(0.42)
    ctx.lineWidth = 1.45
    ctx.stroke()
  }

  const pulseT = reduced ? 0.35 : (t * 0.16) % 1
  const seg = Math.min(PULSE.length - 2, Math.floor(pulseT * (PULSE.length - 1)))
  const local = pulseT * (PULSE.length - 1) - seg
  const pa = placed.get(PULSE[seg])
  const pb = placed.get(PULSE[seg + 1])
  if (pa && pb) {
    const qx = pa.x + (pb.x - pa.x) * local
    const qy = pa.y + (pb.y - pa.y) * local
    const pg = ctx.createRadialGradient(qx, qy, 0, qx, qy, 18)
    pg.addColorStop(0, amb(0.9))
    pg.addColorStop(0.45, amb(0.22))
    pg.addColorStop(1, amb(0))
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.arc(qx, qy, 18, 0, Math.PI * 2)
    ctx.fill()
  }

  drawAperture(ctx, cx, cy, Math.min(rx, ry) * 0.09, t, ir, ig, ib)
  if (props.expand) {
    ctx.font = '12px "Space Grotesk", "PingFang SC", sans-serif'
    ctx.fillStyle = ink(0.88)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ChangeGuard', cx, cy + Math.min(rx, ry) * 0.09 + 16)
  }

  lastPlaced.clear()
  const nodeR = props.expand ? 9 : 6
  for (const n of list) {
    const p = placed.get(n.id)!
    const hot = props.hot.includes(n.id)
    const sat = props.satellites.find(s => s.id === n.id)
    ctx.beginPath()
    ctx.fillStyle = hot ? amb(0.42) : ice(0.32)
    ctx.arc(p.x, p.y, nodeR + 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.fillStyle = hot ? amb(1) : ice(1)
    ctx.arc(p.x, p.y, nodeR * 0.48, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = n.latin
      ? `${props.expand ? 13 : 11}px "JetBrains Mono", monospace`
      : `${props.expand ? 14 : 12}px "PingFang SC", "Microsoft YaHei", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    if (props.expand) {
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(5,7,12,0.88)'
      ctx.strokeText(n.label, p.x, p.y + nodeR + 6)
    }
    ctx.fillStyle = '#f4fbff'
    ctx.fillText(n.label, p.x, p.y + nodeR + 6)
    const v = sat?.value ?? props.values[n.id]
    if (v !== undefined && v !== '') {
      ctx.font = `${props.expand ? 12 : 11}px "JetBrains Mono", monospace`
      ctx.fillStyle = hot ? amb(1) : ice(0.95)
      ctx.fillText(String(v), p.x, p.y + nodeR + 22)
    }
    lastPlaced.set(n.id, p)
  }

  if (!reduced) raf = requestAnimationFrame(frame)
}

function onMove(e: PointerEvent) {
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return
  mx = (e.clientX - rect.left) / Math.max(rect.width, 1)
  my = (e.clientY - rect.top) / Math.max(rect.height, 1)
}

function onClick(e: PointerEvent) {
  if (!props.interactive) return
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  let bestId = ''
  let bestD = props.expand ? 42 : 28
  lastPlaced.forEach((p, id) => {
    const d = Math.hypot(p.x - x, p.y - y)
    if (d < bestD) { bestD = d; bestId = id }
  })
  if (bestId) emit('select', bestId)
}

watch(() => props.satellites, () => {}, { deep: true })

onMounted(() => {
  resize()
  window.addEventListener('resize', resize, { passive: true })
  window.addEventListener('pointermove', onMove, { passive: true })
  canvas.value?.addEventListener('click', onClick)
  raf = requestAnimationFrame(frame)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointermove', onMove)
  canvas.value?.removeEventListener('click', onClick)
})
</script>

<template>
  <canvas ref="canvas" class="lattice" :class="{ live: interactive, expand }" :aria-hidden="!interactive"></canvas>
</template>

<style scoped>
.lattice {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
.lattice.live { pointer-events: auto; cursor: pointer; }
</style>
