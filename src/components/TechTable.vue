<script setup lang="ts" generic="T extends Record<string, any>">
withDefaults(defineProps<{
  columns: { key: string; label: string; width?: string; align?: 'left' | 'center' | 'right'; mono?: boolean }[]
  rows: T[]
  rowKey?: (row: T, i: number) => string
  empty?: string
  loading?: boolean
  click?: (row: T) => void
}>(), { empty: '暂无数据', loading: false })
</script>

<template>
  <div class="ttable">
    <table>
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" :style="{ width: c.width, textAlign: c.align || 'left' }">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading"><td :colspan="columns.length" class="tt-state"><div class="tt-spin"></div> 数据加载中…</td></tr>
        <tr v-else-if="!rows.length"><td :colspan="columns.length" class="tt-state">{{ empty }}</td></tr>
        <tr v-for="(row, i) in rows" :key="(rowKey ? rowKey(row, i) : i)" :class="{ clickable: click }" @click="click?.(row)">
          <td v-for="c in columns" :key="c.key" :style="{ textAlign: c.align || 'left' }" :class="{ mono: c.mono }">
            <slot :name="'cell-' + c.key" :row="row" :index="i">{{ row[c.key] ?? '—' }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ttable { width: 100%; min-height: 0; border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); overflow: auto; }
.ttable table { width: 100%; border-collapse: collapse; }
thead { background: var(--surface-2); }
th {
  padding: .78rem 1.1rem;
  font-size: .8rem;
  font-weight: 500;
  color: var(--text-mute);
  letter-spacing: 0;
  border-bottom: 1px solid var(--line-bright);
  white-space: nowrap;
  text-align: left;
}
td { padding: .82rem 1.1rem; font-size: .92rem; color: var(--text); border-bottom: 1px solid var(--line); line-height: 1.5; }
tbody tr { transition: background var(--dur); }
tbody tr:hover { background: var(--gold-soft); }
tbody tr:last-child td { border-bottom: none; }
tr.clickable { cursor: pointer; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.tt-state { text-align: center !important; color: var(--text-faint); padding: 2rem !important; }
.tt-spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--line); border-top-color: var(--gold); border-radius: 50%; animation: spin .8s linear infinite; vertical-align: middle; margin-right: .4rem; }
</style>
