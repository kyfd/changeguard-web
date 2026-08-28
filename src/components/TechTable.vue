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
.ttable { width: 100%; min-height: 0; border-radius: var(--r); background: var(--surface); border: 1px solid var(--line); overflow: auto; }
.ttable table { width: 100%; border-collapse: collapse; }
/* 表头吸顶：长列表滚动时仍能对上列义 */
thead { background: var(--surface-2); position: sticky; top: 0; z-index: 1; }
th {
  height: 36px;
  padding: 0 var(--sp-4);
  font-size: var(--fs-12);
  font-weight: var(--fw-medium);
  color: var(--text-mute);
  letter-spacing: 0.01em;
  border-bottom: 1px solid var(--line-strong);
  white-space: nowrap;
  text-align: left;
}
/* 工单表是扫读界面，行高按可比对性收紧而非按舒适度撑开 */
td {
  height: 44px;
  padding: 0 var(--sp-4);
  font-size: var(--fs-13);
  color: var(--text);
  border-bottom: 1px solid var(--line);
  line-height: var(--lh-snug);
}
tbody tr { transition: background var(--dur-fast); }
tbody tr:hover { background: var(--gold-soft); }
tbody tr:last-child td { border-bottom: none; }
tr.clickable { cursor: pointer; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: var(--fs-12); }
.tt-state { text-align: center !important; color: var(--text-faint); padding: var(--sp-10) !important; font-size: var(--fs-13); }
.tt-spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--line); border-top-color: var(--gold); border-radius: 50%; animation: spin .8s linear infinite; vertical-align: middle; margin-right: var(--sp-2); }
</style>
