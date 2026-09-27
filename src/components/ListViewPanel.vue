<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, type ComponentPublicInstance } from 'vue'
import { useJsonDocumentStore } from '@/stores/jsonDocument'
import { useListViewStore } from '@/stores/listView'
import { buildArrayTable, findTreeNodeById, type JsonTable } from '@/utils/json'

const MIN_HEIGHT = 160
const MIN_BOTTOM_GAP = 8

const documentStore = useJsonDocumentStore()
const store = useListViewStore()

const editingId = ref<string | null>(null)
const editingValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

/** Drag-resizable height; ignored while the drawer is full screen. */
const panelHeight = ref(Math.min(360, Math.round(window.innerHeight * 0.46)))
const fullscreen = ref(false)
const resizing = ref(false)

let dragStartY = 0
let dragStartHeight = 0

const panelStyle = computed(() =>
  fullscreen.value ? undefined : { height: `${panelHeight.value}px` },
)

function maxHeight(): number {
  return Math.max(MIN_HEIGHT, window.innerHeight - MIN_BOTTOM_GAP)
}

function clampHeight(value: number): number {
  return Math.min(Math.max(value, MIN_HEIGHT), maxHeight())
}

function onDragStart(event: PointerEvent): void {
  if (fullscreen.value) return
  if ((event.target as HTMLElement).closest('button')) return
  event.preventDefault()
  resizing.value = true
  dragStartY = event.clientY
  dragStartHeight = panelHeight.value
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
}

function onDragMove(event: PointerEvent): void {
  if (!resizing.value) return
  // Dragging up grows the drawer, dragging down shrinks it.
  panelHeight.value = clampHeight(dragStartHeight + (dragStartY - event.clientY))
}

function onDragEnd(): void {
  resizing.value = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
}

function onWindowResize(): void {
  if (!fullscreen.value) panelHeight.value = clampHeight(panelHeight.value)
}

function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
}

/** Rebuilt from the live document so tabs follow edits without storing a snapshot. */
const table = computed<JsonTable | null>(() => {
  const tab = store.activeTab
  if (!tab) return null
  const root = documentStore.tree
  if (!root) return null
  const node = findTreeNodeById(root, tab.path)
  if (!node || node.kind !== 'array') return null
  return buildArrayTable(documentStore.text, node)
})

function setRenameInput(element: Element | ComponentPublicInstance | null): void {
  renameInput.value = element as HTMLInputElement | null
}

async function startRename(id: string, current: string): Promise<void> {
  editingId.value = id
  editingValue.value = current
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

function commitRename(): void {
  const id = editingId.value
  if (id === null) return
  store.renameTab(id, editingValue.value)
  editingId.value = null
}

function cancelRename(): void {
  editingId.value = null
}

function onRenameKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
}

window.addEventListener('resize', onWindowResize)

onBeforeUnmount(() => {
  onDragEnd()
  window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="list-panel">
      <section
        v-if="store.open"
        class="list-panel"
        :class="{ fullscreen, resizing }"
        :style="panelStyle"
        aria-label="列表查看"
      >
        <header class="list-header" @pointerdown="onDragStart">
          <span class="list-grip" aria-hidden="true"></span>
          <span class="list-heading">列表查看</span>
          <button
            type="button"
            class="list-action"
            :title="fullscreen ? '退出全屏' : '全屏'"
            :aria-label="fullscreen ? '退出全屏' : '全屏'"
            @click="toggleFullscreen()"
          >
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <template v-if="fullscreen">
                <path d="M5.5 8.5 L2 12" />
                <path d="M8.5 5.5 L12 2" />
                <path d="M2 8.5 V12 H5.5" />
                <path d="M12 5.5 V2 H8.5" />
              </template>
              <template v-else>
                <path d="M8.5 2 H12 V5.5" />
                <path d="M5.5 12 H2 V8.5" />
                <path d="M12 2 L8 6" />
                <path d="M2 12 L6 8" />
              </template>
            </svg>
          </button>
          <button
            type="button"
            class="list-action"
            title="关闭面板"
            aria-label="关闭面板"
            @click="store.closeAll()"
          >
            ×
          </button>
        </header>

        <div class="list-tabs" role="tablist">
          <div
            v-for="tab in store.tabs"
            :key="tab.id"
            class="list-tab"
            :class="{ active: tab.id === store.activeId }"
            :title="tab.path"
            role="tab"
            :aria-selected="tab.id === store.activeId"
            @click="store.activate(tab.id)"
            @dblclick="startRename(tab.id, tab.title)"
          >
            <input
              v-if="editingId === tab.id"
              :ref="setRenameInput"
              v-model="editingValue"
              class="list-tab-input"
              @click.stop
              @dblclick.stop
              @keydown="onRenameKeydown"
              @blur="commitRename"
            />
            <span v-else class="list-tab-label">{{ tab.title }}</span>
            <button
              type="button"
              class="list-tab-close"
              title="关闭"
              aria-label="关闭"
              @click.stop="store.closeTab(tab.id)"
            >
              ×
            </button>
          </div>
        </div>

        <div class="list-body">
          <table v-if="table && table.columns.length > 0" class="list-table">
            <thead>
              <tr>
                <th
                  v-for="(column, columnIndex) in table.columns"
                  :key="columnIndex"
                  :title="column"
                >
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in table.rows" :key="rowIndex">
                <td
                  v-for="(cell, cellIndex) in row"
                  :key="cellIndex"
                  :title="cell"
                  :class="{ 'cell-empty': cell === '' }"
                >
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="list-empty">
            <p v-if="!documentStore.tree">文档无法解析，暂时无法展示该数组</p>
            <p v-else>未找到对应的数组，或数组为空</p>
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.list-panel {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 38;
  display: flex;
  flex-direction: column;
  max-height: 100vh;
  border-top: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 -8px 24px rgb(101 123 131 / 18%);
}

.list-panel.fullscreen {
  height: 100vh;
}

.list-panel.resizing {
  user-select: none;
  cursor: ns-resize;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 26px;
  padding: 0 6px 0 10px;
  border-bottom: 1px solid var(--border-soft);
  cursor: ns-resize;
}

.list-panel.fullscreen .list-header {
  cursor: default;
}

.list-grip {
  width: 34px;
  height: 4px;
  border-radius: 999px;
  background: var(--border-strong);
}

.list-heading {
  margin-right: auto;
  font-size: 11.5px;
  color: var(--text-muted);
}

.list-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.list-action:hover {
  color: var(--text);
  background: var(--surface-strong);
}

.list-action svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.list-tabs {
  display: flex;
  flex: none;
  gap: 2px;
  padding: 5px 8px 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
}

.list-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  max-width: 240px;
  height: 28px;
  padding: 0 4px 0 10px;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.list-tab:hover {
  color: var(--text);
  background: var(--surface-hover);
}

.list-tab.active {
  color: var(--text);
  border-color: var(--border);
  background: var(--surface-active);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.list-tab-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace;
}

.list-tab-input {
  width: 150px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
}

.list-tab-input:focus {
  outline: none;
}

.list-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-faint);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.list-tab-close:hover {
  color: var(--danger);
  background: var(--surface-strong);
}

.list-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.list-table {
  border-collapse: collapse;
  font-size: 12px;
}

.list-table th,
.list-table td {
  max-width: 320px;
  padding: 5px 10px;
  overflow: hidden;
  border-right: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.list-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-strong);
  color: var(--text);
  font-weight: 600;
  font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace;
}

.list-table td {
  color: var(--text);
  font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace;
}

.list-table tbody tr:hover td {
  background: var(--surface-hover);
}

.cell-empty {
  color: var(--text-faint);
}

.list-empty {
  padding: 30px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12.5px;
}

.list-empty p {
  margin: 0;
}

.list-panel-enter-active,
.list-panel-leave-active {
  transition: transform 0.22s ease;
}

.list-panel-enter-from,
.list-panel-leave-to {
  transform: translateY(100%);
}
</style>
