<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useJsonDocumentStore } from '@/stores/jsonDocument'
import { useListViewStore } from '@/stores/listView'
import { nodeCopyValue, type JsonTreeNode } from '@/utils/json'

interface TreeRow {
  node: JsonTreeNode
  depth: number
}

interface VisibleRow {
  row: TreeRow
  index: number
}

interface ContextMenuState {
  x: number
  y: number
  node: JsonTreeNode
}

/** Nodes at or above this depth start expanded; deeper ones start collapsed. */
const DEFAULT_EXPANDED_DEPTH = 1

/** Fixed row height, mirrored inline on every row so the virtual window stays aligned. */
const ROW_HEIGHT = 24
const OVERSCAN = 12

/** Mirror of the menu's fixed dimensions, used to keep it inside the viewport. */
const MENU_WIDTH = 172
const MENU_ROW_HEIGHT = 32
const MENU_PADDING = 4

const props = defineProps<{ visible?: boolean }>()

const store = useJsonDocumentStore()
const listView = useListViewStore()
const { t } = useI18n()
const overrides = ref(new Map<string, boolean>())
const scroller = ref<HTMLDivElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(600)
const contextMenu = ref<ContextMenuState | null>(null)
const activeId = ref<string | null>(null)

const rows = computed<TreeRow[]>(() => {
  const root = store.tree
  if (!root || props.visible === false) return []
  const result: TreeRow[] = []
  const walk = (node: JsonTreeNode, depth: number): void => {
    result.push({ node, depth })
    if (node.children.length === 0 || !isExpanded(node, depth)) return
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(root, 0)
  return result
})

/** Only the rows inside the viewport are rendered; the tree can hold tens of thousands of nodes. */
const visibleRows = computed<VisibleRow[]>(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
  const count = Math.ceil(viewportHeight.value / ROW_HEIGHT) + OVERSCAN * 2
  return rows.value
    .slice(start, start + count)
    .map((row, offset) => ({ row, index: start + offset }))
})

const totalHeight = computed(() => `${rows.value.length * ROW_HEIGHT}px`)

function onScroll(event: Event): void {
  scrollTop.value = (event.target as HTMLElement).scrollTop
  closeContextMenu()
}

function isExpanded(node: JsonTreeNode, depth: number): boolean {
  return overrides.value.get(node.id) ?? depth <= DEFAULT_EXPANDED_DEPTH
}

function toggle(node: JsonTreeNode, depth: number): void {
  overrides.value.set(node.id, !isExpanded(node, depth))
}

function setAllExpanded(expanded: boolean): void {
  const next = new Map<string, boolean>()
  const walk = (node: JsonTreeNode): void => {
    if (node.children.length > 0) next.set(node.id, expanded)
    for (const child of node.children) walk(child)
  }
  const root = store.tree
  if (root) walk(root)
  overrides.value = next
  if (scroller.value) scroller.value.scrollTop = 0
}

function openContextMenu(event: MouseEvent, node: JsonTreeNode): void {
  activeId.value = node.id
  const baseRows = node.key === null ? 2 : 3
  const rows = baseRows + (node.kind === 'array' ? 1 : 0)
  const height = rows * MENU_ROW_HEIGHT + MENU_PADDING * 2
  contextMenu.value = {
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - MENU_WIDTH - 8)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
    node,
  }
}

function closeContextMenu(): void {
  contextMenu.value = null
}

async function copyToClipboard(value: string, message: string): Promise<void> {
  closeContextMenu()
  try {
    await navigator.clipboard.writeText(value)
    store.notify(message)
  } catch {
    store.notify('复制失败，请手动选择后复制')
  }
}

function copyPath(): void {
  const node = contextMenu.value?.node
  if (!node) return
  void copyToClipboard(node.id, `已复制路径 ${node.id}`)
}

function copyKey(): void {
  const node = contextMenu.value?.node
  if (!node || node.key === null) return
  void copyToClipboard(node.key, `已复制 Key ${node.key}`)
}

function copyValue(): void {
  const node = contextMenu.value?.node
  if (!node) return
  // 基础类型只复制值，对象/数组复制完整 JSON 源码。
  void copyToClipboard(nodeCopyValue(store.text, node), '已复制值')
}

function openList(): void {
  const node = contextMenu.value?.node
  if (!node || node.kind !== 'array') return
  closeContextMenu()
  listView.openTab(node.id)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeContextMenu()
}

function keyLabel(node: JsonTreeNode): string {
  if (node.key === null) return '$'
  return node.isArrayItem ? `[${node.key}]` : node.key
}

function summaryOf(node: JsonTreeNode): string {
  return node.kind === 'object'
    ? `{ ${t('tree.objectSummary', node.childCount)} }`
    : `[ ${t('tree.arraySummary', node.childCount)} ]`
}

function valueLabel(row: TreeRow): string {
  const { node, depth } = row
  if (node.children.length === 0) return node.preview
  return isExpanded(node, depth) ? summaryOf(node) : node.preview
}

let resizeObserver: ResizeObserver | null = null

// The scroller only exists once the document parses, so attach to the element when it appears.
watch(
  scroller,
  (element) => {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (!element) return
    resizeObserver = new ResizeObserver(() => {
      viewportHeight.value = element.clientHeight
    })
    resizeObserver.observe(element)
    viewportHeight.value = element.clientHeight
  },
  { flush: 'post' },
)

// Only listen for Escape while the context menu is open.
watch(contextMenu, (menu) => {
  if (menu) {
    window.addEventListener('keydown', onKeydown)
    return
  }
  window.removeEventListener('keydown', onKeydown)
  activeId.value = null
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="tree-panel">
    <div class="tree-toolbar">
      <span class="tree-count">{{ $t('tree.rowCount', rows.length) }}</span>
      <button type="button" class="ghost-button" @click="setAllExpanded(true)">
        {{ $t('tree.expandAll') }}
      </button>
      <button type="button" class="ghost-button" @click="setAllExpanded(false)">
        {{ $t('tree.collapseAll') }}
      </button>
    </div>

    <div v-if="store.analysis.status === 'invalid'" class="panel-empty">
      <p>{{ store.issues[0]?.message ?? $t('tree.syntaxError') }}</p>
      <p class="panel-hint">{{ $t('tree.issueHint', store.issues.length) }}</p>
    </div>
    <div v-else-if="store.analysis.status === 'empty'" class="panel-empty">
      <p>{{ $t('tree.empty') }}</p>
      <p class="panel-hint">{{ $t('tree.emptyHint') }}</p>
    </div>
    <div v-else ref="scroller" class="tree-rows" @scroll="onScroll">
      <div class="tree-rows-inner" :style="{ height: totalHeight }">
        <div
          v-for="entry in visibleRows"
          :key="entry.row.node.id"
          class="tree-row"
          :class="{ 'tree-row-active': activeId === entry.row.node.id }"
          :style="{
            height: `${ROW_HEIGHT}px`,
            lineHeight: `${ROW_HEIGHT}px`,
            paddingLeft: `${entry.row.depth * 14 + 6}px`,
            transform: `translateY(${entry.index * ROW_HEIGHT}px)`,
          }"
          :title="entry.row.node.id"
          @click="store.requestReveal(entry.row.node.start, entry.row.node.end)"
          @contextmenu.prevent="openContextMenu($event, entry.row.node)"
        >
          <button
            v-if="entry.row.node.children.length > 0"
            type="button"
            class="twisty"
            :class="{ expanded: isExpanded(entry.row.node, entry.row.depth) }"
            :aria-label="
              isExpanded(entry.row.node, entry.row.depth) ? $t('tree.collapse') : $t('tree.expand')
            "
            @click.stop="toggle(entry.row.node, entry.row.depth)"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M4 2.5 L8 6 L4 9.5" />
            </svg>
          </button>
          <span v-else class="twisty twisty-empty"></span>

          <span class="tree-key" :class="{ 'tree-key-root': entry.row.node.key === null }">
            {{ keyLabel(entry.row.node) }}
          </span>
          <span class="tree-colon">:</span>
          <span class="tree-value" :class="`kind-${entry.row.node.kind}`">
            {{ valueLabel(entry.row) }}
          </span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="contextMenu"
        class="tree-menu-backdrop"
        @click="closeContextMenu"
        @contextmenu.prevent="closeContextMenu"
      ></div>
      <div
        v-if="contextMenu"
        class="tree-menu"
        role="menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px`, width: `${MENU_WIDTH}px` }"
        @click.stop
      >
        <button type="button" class="tree-menu-item" role="menuitem" @click="copyPath()">
          {{ $t('tree.copyPath') }}
        </button>
        <button
          type="button"
          class="tree-menu-item"
          role="menuitem"
          :disabled="contextMenu.node.key === null"
          @click="copyKey()"
        >
          {{ $t('tree.copyKey') }}
        </button>
        <button type="button" class="tree-menu-item" role="menuitem" @click="copyValue()">
          {{ $t('tree.copyValue') }}
        </button>
        <button
          v-if="contextMenu.node.kind === 'array'"
          type="button"
          class="tree-menu-item"
          role="menuitem"
          @click="openList()"
        >
          {{ $t('tree.openList') }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tree-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.tree-count {
  margin-right: auto;
  font-size: 12px;
  color: var(--text-muted);
}

.tree-rows {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.tree-rows-inner {
  position: relative;
}

.tree-row {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 10px;
  font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  white-space: nowrap;
  cursor: pointer;
}

.tree-row:hover {
  background: var(--surface-hover);
}

.tree-row-active {
  background: var(--surface-active);
  box-shadow: inset 2px 0 0 var(--accent);
}

.twisty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.twisty svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.12s ease;
}

.twisty.expanded svg {
  transform: rotate(90deg);
}

.twisty:hover {
  background: var(--surface-strong);
  color: var(--text);
}

.twisty-empty {
  cursor: default;
}

.tree-key {
  color: var(--json-key);
}

.tree-key-root {
  color: var(--text-muted);
  font-style: italic;
}

.tree-colon {
  color: var(--text-muted);
}

.tree-value {
  overflow: hidden;
  text-overflow: ellipsis;
}

.kind-string {
  color: var(--json-string);
}

.kind-number {
  color: var(--json-number);
}

.kind-boolean,
.kind-null {
  color: var(--json-keyword);
}

.kind-object,
.kind-array {
  color: var(--text-muted);
}

.tree-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.tree-menu {
  position: fixed;
  z-index: 51;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.tree-menu-item {
  display: block;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.tree-menu-item:hover:not(:disabled) {
  background: var(--surface-hover);
}

.tree-menu-item:disabled {
  color: var(--text-faint);
  cursor: default;
}
</style>
