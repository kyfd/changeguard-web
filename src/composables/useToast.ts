import { ref } from 'vue'

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

const toasts = ref<ToastItem[]>([])

let seed = 0

function show(type: ToastItem['type'], message: string, duration = 3200) {
  const id = `toast_${Date.now()}_${++seed}`
  const item: ToastItem = { id, type, message, duration }
  toasts.value.push(item)

  if (duration > 0) {
    setTimeout(() => {
      dismiss(id)
    }, duration)
  }
  return id
}

function dismiss(id: string) {
  const idx = toasts.value.findIndex((t) => t.id === id)
  if (idx !== -1) {
    toasts.value.splice(idx, 1)
  }
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (msg: string, dur?: number) => show('success', msg, dur),
    error: (msg: string, dur?: number) => show('error', msg, dur),
    warning: (msg: string, dur?: number) => show('warning', msg, dur),
    info: (msg: string, dur?: number) => show('info', msg, dur),
  }
}
