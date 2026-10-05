<script setup lang="ts" generic="T extends Record<string, any>">
withDefaults(
  defineProps<{
    columns: { key: string; label: string; width?: string; align?: 'left' | 'center' | 'right'; mono?: boolean }[]
    rows: T[]
    rowKey?: (row: T, i: number) => string
    empty?: string
    loading?: boolean
    click?: (row: T) => void
  }>(),
  { empty: '暂无数据', loading: false }
)
</script>

<template>
  <div class="ttable">
    <table>
      <thead>
        <tr>
          <th
            v-for="c in columns"
            :key="c.key"
            :style="{ width: c.width, textAlign: c.align || 'left' }"
          >
            {{ c.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length" class="tt-state">
            <div class="tt-spin"></div> 数据加载中…
          </td>
        </tr>
        <tr v-else-if="!rows.length">
          <td :colspan="columns.length" class="tt-state">{{ empty }}</td>
        </tr>
        <tr
          v-for="(row, i) in rows"
          :key="rowKey ? rowKey(row, i) : i"
          :class="{ clickable: click }"
          @click="click?.(row)"
        >
          <td
            v-for="c in columns"
            :key="c.key"
            :style="{ textAlign: c.align || 'left' }"
            :class="{ mono: c.mono }"
          >
            <slot :name="'cell-' + c.key" :row="row" :index="i">{{ row[c.key] ?? '—' }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ttable {
  width: 100%;
  min-height: 0;
  border-radius: var(--r-xl);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
  overflow: auto;
  backdrop-filter: blur(8px);
}
.ttable table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--surface-2);
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid var(--line);
}
th {
  height: 42px;
  padding: 0 var(--sp-4);
  font-family: var(--font-mono);
  font-size: var(--fs-11);
  font-weight: var(--fw-semibold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-mute);
  white-space: nowrap;
  text-align: left;
}

td {
  height: 48px;
  padding: 0 var(--sp-4);
  font-size: var(--fs-13);
  color: var(--text);
  border-bottom: 1px solid var(--line);
  line-height: var(--lh-snug);
  transition: background var(--dur-fast);
}

tbody tr {
  transition: all var(--dur-fast);
}
tbody tr:hover {
  background: var(--bg-elev);
}
tbody tr:last-child td {
  border-bottom: none;
}
tr.clickable {
  cursor: pointer;
}

.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-12);
}

.tt-state {
  text-align: center !important;
  color: var(--text-faint);
  padding: 80px var(--sp-4) !important;
  font-size: var(--fs-13);
}

.tt-spin {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--line);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
  margin-right: var(--sp-2);
}
</style>
