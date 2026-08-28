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

/* 语义着色：高危命中 = 朱砂，待审积压 = 琥珀，其余保持静默 */
const RISK_NODES = new Set(['sql', 'verify'])
const WARN_NODES = new Set(['approve', 'gate'])

/* 3 条参考轨（hairline），节点落在轨上；外圈承载 ring2 + 卫星 */
const RING_K = [0.36, 0.62, 0.88]

const lastPlaced = new Map<string, { x: number; y: number; n: NodeDef }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let w = 0
let h = 0
let dpr = 1
let mx = -1
let my = -1
let hoverId = ''

const SHIELD_PATH = new Path2D(
  'M12 2.6 4.4 5.45v6.2c0 4.78 3.3 7.87 7.6 9.75 4.3-1.88 7.6-4.97 7.6-9.75v-6.2Z',
)
const SHIELD_BAR = new Path2D('M7.1 10.9h9.8v2.2h-9.8Z')

function nodesNow(): NodeDef[] {
  const extra: NodeDef[] = (props.satellites || []).slice(0, 8).map((s, i) => ({
    id: s.id,
    label: s.label,
    ring: 2,
    a0: (i / Math.max(1, Math.min(8, props.satellites.length))) * Math.PI * 2 + 0.2,
    route: 'apps',
  }))
  return extra.length ? [...CORE, ...extra] : [
    ...CORE,
    { id: 'sat-a', label: '预发', ring: 2, a0: 0.75, route: 'risks' },
    { id: 'sat-b', label: '灰度', ring: 2, a0: 1.85, route: 'changes' },
    { id: 'sat-c', label: '生产', ring: 2, a0: 2.95, route: 'approvals' },
    { id: 'sat-d', label: '回放', ring: 2, a0: 4.05, route: 'audits' },
    { id: 'sat-e', label: '下游', ring: 2, a0: 5.15, route: 'apps' },
  ]
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
}

/* 每帧一次性读取主题色，避免逐节点查询计算样式 */
function palette() {
  const s = getComputedStyle(document.documentElement)
  const get = (n: string, fb: string) => s.getPropertyValue(n).trim() || fb
  return {
    brand: get('--brand', '#4a55cc'),
    brandSoft: get('--brand-soft', 'rgba(74,85,204,0.08)'),
    lineBright: get('--line-bright', 'rgba(74,85,204,0.32)'),
    line: get('--line', 'rgba(22,28,45,0.10)'),
    lineStrong: get('--line-strong', 'rgba(22,28,45,0.17)'),
    cinnabar: get('--cinnabar', '#c73a3f'),
    amber: get('--amber', '#96660d'),
    textFaint: get('--text-faint', '#6e7684'),
    textMute: get('--text-mute', '#5f6775'),
    text: get('--text', '#333b47'),
    bgVoid: get('--bg-void', '#f6f7f9'),
  }
}

function posOf(n: NodeDef, cx: number, cy: number, rx: number, ry: number) {
  const m = RING_K[Math.min(n.ring, RING_K.length - 1)]
  return { x: cx + Math.cos(n.a0) * rx * m, y: cy + Math.sin(n.a0) * ry * m, n }
}

function rrect(c: CanvasRenderingContext2D, x: number, y: number, s: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + s - r, y)
  c.quadraticCurveTo(x + s, y, x + s, y + r)
  c.lineTo(x + s, y + s - r)
  c.quadraticCurveTo(x + s, y + s, x + s - r, y + s)
  c.lineTo(x + r, y + s)
  c.quadraticCurveTo(x, y + s, x, y + s - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

/* 中心枢纽：扁平圆盘 + 盾形标识 + mono 品牌字，无辉光 */
function drawHub(c: CanvasRenderingContext2D, x: number, y: number, pal: ReturnType<typeof palette>) {
  const R = props.expand ? 26 : 22
  c.beginPath()
  c.arc(x, y, R, 0, Math.PI * 2)
  c.fillStyle = pal.brandSoft
  c.fill()
  c.strokeStyle = pal.lineBright
  c.lineWidth = 1
  c.stroke()

  const s = R / 15
  c.save()
  c.translate(x - 12 * s, y - 12 * s)
  c.scale(s, s)
  c.strokeStyle = pal.brand
  c.lineWidth = 1.6
  c.lineJoin = 'round'
  c.stroke(SHIELD_PATH)
  c.fillStyle = pal.brand
  c.fill(SHIELD_BAR)
  c.restore()

  c.font = '11px "JetBrains Mono", monospace'
  c.fillStyle = pal.textMute
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText('ChangeGuard', x, y + R + 14)
}

function draw() {
  if (!ctx) return
  const pal = palette()
  ctx.clearRect(0, 0, w, h)

  const cx = w * 0.5
  const cy = h * (props.expand ? 0.52 : 0.48)
  // 两侧信息面板让出横向空间
  const inset = props.expand ? Math.min(320, w * 0.24) : 0
  const rx = props.expand ? Math.max(240, (w - inset * 2) * 0.46) : Math.min(w, h) * 0.42
  const ry = props.expand ? h * 0.42 : h * 0.4
  const list = nodesNow()

  // 参考轨：3 条 hairline
  ctx.strokeStyle = pal.line
  ctx.lineWidth = 1
  for (const k of RING_K) {
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  const placed = new Map<string, { x: number; y: number; n: NodeDef }>()
  for (const n of list) placed.set(n.id, posOf(n, cx, cy, rx, ry))

  // 节点间连线：治理链路，1px hairline。
  // 两端计数都为 0 的链路降到 35% 透明度：零态下不显示穿过枢纽的乱线，
  // 有活动的链路保持完整。
  const countOf = (id: string) => {
    const sat = props.satellites.find(s => s.id === id)
    const raw = sat?.value ?? props.values[id]
    const n = Number(raw)
    return Number.isFinite(n) ? n : 1
  }
  ctx.lineWidth = 1
  for (const [a, b] of EDGES) {
    const pa = placed.get(a)
    const pb = placed.get(b)
    if (!pa || !pb) continue
    ctx.globalAlpha = countOf(a) === 0 && countOf(b) === 0 ? 0.35 : 1
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // hover 命中：指针最近的节点（仅交互模式）
  hoverId = ''
  if (props.interactive && mx >= 0) {
    let bestD = 16
    placed.forEach((p, id) => {
      const d = Math.hypot(p.x - mx, p.y - my)
      if (d < bestD) { bestD = d; hoverId = id }
    })
  }

  drawHub(ctx, cx, cy, pal)

  const nodeR = props.expand ? 8 : 7
  for (const n of list) {
    const p = placed.get(n.id)!
    const hot = props.hot.includes(n.id)
    const risk = hot && RISK_NODES.has(n.id)
    const warn = hot && WARN_NODES.has(n.id)
    const hovered = hoverId === n.id

    ctx.beginPath()
    rrect(ctx, p.x - nodeR / 2, p.y - nodeR / 2, nodeR, nodeR, 2)
    if (hovered) ctx.fillStyle = pal.brand
    else if (risk) ctx.fillStyle = pal.cinnabar
    else if (warn) ctx.fillStyle = pal.amber
    else ctx.fillStyle = pal.textFaint
    ctx.fill()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    // 底色 knock-out，保证标签压线时可读
    ctx.lineWidth = 3
    ctx.strokeStyle = pal.bgVoid
    ctx.lineJoin = 'round'
    ctx.font = n.latin
      ? '12px "JetBrains Mono", monospace'
      : '12px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.strokeText(n.label, p.x, p.y + nodeR / 2 + 5)
    ctx.fillStyle = hovered ? pal.brand : pal.textMute
    ctx.fillText(n.label, p.x, p.y + nodeR / 2 + 5)

    const v = props.values[n.id]
    const sat = props.satellites.find(s => s.id === n.id)
    const shown = sat?.value ?? v
    if (shown !== undefined && shown !== '') {
      ctx.font = '11px "JetBrains Mono", monospace'
      ctx.strokeText(String(shown), p.x, p.y + nodeR / 2 + 21)
      ctx.fillStyle = risk ? pal.cinnabar : warn ? pal.amber : pal.text
      ctx.fillText(String(shown), p.x, p.y + nodeR / 2 + 21)
    }
    lastPlaced.set(n.id, p)
  }

  /* 静态帧循环：重绘始终是同一张平面图（无任何持续动画），
     同时天然覆盖主题切换与数据更新后的重绘 */
  raf = requestAnimationFrame(draw)
}

function onResize() {
  resize()
  draw()
}

function onMove(e: PointerEvent) {
  const rect = canvas.value?.getBoundingClientRect()
  if (!rect) return
  mx = e.clientX - rect.left
  my = e.clientY - rect.top
  if (props.expand) draw()
  else if (!raf) raf = requestAnimationFrame(draw)
}

function onLeave() {
  mx = -1
  my = -1
  if (props.expand) draw()
}

function onClick(e: MouseEvent) {
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

watch(() => [props.values, props.hot, props.satellites], () => {
  if (props.expand) draw()
}, { deep: true })

onMounted(() => {
  resize()
  window.addEventListener('resize', onResize)
  window.addEventListener('pointermove', onMove, { passive: true })
  canvas.value?.addEventListener('pointerleave', onLeave)
  canvas.value?.addEventListener('click', onClick)
  raf = requestAnimationFrame(draw)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onMove)
  canvas.value?.removeEventListener('pointerleave', onLeave)
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
