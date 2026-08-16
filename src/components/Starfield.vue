<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

/* Quiet observatory dust — no grid floor, no competing orbs, no digital rain */
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let w = 0
let h = 0
let dpr = 1
let t = 0
const dots: { x: number; y: number; r: number; a: number; p: number }[] = []
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function seed() {
  dots.length = 0
  const n = Math.max(24, Math.floor((w * h) / 36000))
  for (let i = 0; i < n; i++) {
    dots.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.1 + 0.25,
      a: 0.12 + Math.random() * 0.28,
      p: Math.random() * 6.28,
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
  seed()
}

function frame(now: number) {
  if (!ctx) return
  t = now * 0.001
  ctx.clearRect(0, 0, w, h)
  for (const a of dots) {
    const glow = reduced ? a.a : a.a * (0.7 + Math.sin(t * 0.7 + a.p) * 0.3)
    ctx.beginPath()
    ctx.fillStyle = `rgba(232,228,220,${glow})`
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
    ctx.fill()
  }
  if (!reduced) raf = requestAnimationFrame(frame)
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize, { passive: true })
  raf = requestAnimationFrame(frame)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvas" class="starfield" aria-hidden="true"></canvas>
</template>

<style scoped>
.starfield { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
</style>
