<script setup lang="ts">
import type * as Monaco from 'monaco-editor'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { MONACO_THEME } from '@/monaco/theme'
import { SCHEMA_EDITOR_URI } from '@/monaco/uri'
import { useJsonDocumentStore } from '@/stores/jsonDocument'
import { useSchemaSupportStore } from '@/stores/schemaSupport'

const store = useSchemaSupportStore()
const documentStore = useJsonDocumentStore()

const editorHost = ref<HTMLDivElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const editorReady = ref(false)

let monacoApi: typeof import('monaco-editor') | null = null
let editor: Monaco.editor.IStandaloneCodeEditor | null = null
let model: Monaco.editor.ITextModel | null = null
const disposables: Monaco.IDisposable[] = []
const stopHandles: (() => void)[] = []
/** Guards the store <-> model loop while one side pushes into the other. */
let applying = false
let initialized = false

const activeContent = computed(() => store.activeMapping?.content ?? '')

const EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  fontFamily: "'JetBrains Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace",
  fontSize: 12.5,
  lineHeight: 20,
  detectIndentation: false,
  tabSize: 2,
  insertSpaces: true,
  folding: true,
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  renderLineHighlight: 'line',
  padding: { top: 8, bottom: 8 },
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
    alwaysConsumeMouseWheel: false,
  },
  fixedOverflowWidgets: true,
  useShadowDOM: false,
}

function syncModelFromStore(): void {
  if (!model) return
  applying = true
  model.setValue(activeContent.value)
  applying = false
  editor?.setPosition({ lineNumber: 1, column: 1 })
  editor?.setScrollTop(0)
  editor?.updateOptions({ readOnly: store.activeMapping === null })
}

function formatTime(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function addFromSearch(): void {
  const url = store.search.trim()
  if (url.length === 0) {
    documentStore.notify('请先输入 schema 的 URL')
    return
  }
  const result = store.addMapping(url)
  documentStore.notify(result.message)
  if (result.ok) store.search = ''
}

async function refetch(): Promise<void> {
  const url = store.activeUrl
  if (!url) return
  const result = await store.fetchIntoMapping(url)
  documentStore.notify(result.message)
}

function removeActive(): void {
  const url = store.activeUrl
  if (!url) return
  store.removeMapping(url)
  documentStore.notify('已删除映射')
}

function onUrlChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const previous = store.activeUrl
  if (!previous) return
  const result = store.renameMapping(previous, input.value)
  if (!result.ok) {
    input.value = previous
    documentStore.notify(result.message)
    return
  }
  if (result.message) documentStore.notify(result.message)
}

/** The drawer is always mounted, but its editor is only created the first time it is opened. */
async function ensureEditor(): Promise<void> {
  if (initialized || !store.panelOpen) return
  initialized = true
  const [api, setup] = await Promise.all([import('monaco-editor'), import('@/monaco/setup')])
  if (!editorHost.value) {
    initialized = false
    return
  }
  setup.setupMonaco()
  monacoApi = api

  const createdModel = api.editor.createModel(
    activeContent.value,
    'json',
    api.Uri.parse(SCHEMA_EDITOR_URI),
  )
  createdModel.setEOL(api.editor.EndOfLineSequence.LF)
  const createdEditor = api.editor.create(editorHost.value, {
    model: createdModel,
    theme: MONACO_THEME[documentStore.theme],
    readOnly: store.activeMapping === null,
    ...EDITOR_OPTIONS,
  })
  model = createdModel
  editor = createdEditor

  disposables.push(
    createdEditor.onDidChangeModelContent(() => {
      if (applying) return
      const url = store.activeUrl
      if (!url) return
      store.setContent(url, createdModel.getValue())
    }),
  )

  stopHandles.push(
    watch(() => store.activeUrl, syncModelFromStore),
    watch(activeContent, (value) => {
      if (!model || applying || model.getValue() === value) return
      syncModelFromStore()
    }),
    watch(
      () => documentStore.theme,
      (mode) => {
        monacoApi?.editor.setTheme(MONACO_THEME[mode])
      },
    ),
    watch(
      () => store.activeMapping !== null,
      (hasMapping) => createdEditor.updateOptions({ readOnly: !hasMapping }),
    ),
  )

  editorReady.value = true
}

watch(
  () => store.panelOpen,
  async (open) => {
    if (!open) return
    await nextTick()
    await ensureEditor()
    searchInput.value?.focus()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  for (const stop of stopHandles) stop()
  for (const disposable of disposables) disposable.dispose()
  editor?.dispose()
  model?.dispose()
  editor = null
  model = null
  monacoApi = null
})
</script>

<template>
  <Teleport to="body">
    <Transition name="schema-panel">
      <div v-if="store.panelOpen" class="schema-overlay" @mousedown.self="store.closePanel()">
        <aside class="schema-drawer">
          <header class="schema-header">
            <div class="schema-title">
              <h2>{{ $t('schema.panelTitle') }}</h2>
              <p>{{ $t('schema.panelHint') }}</p>
            </div>
            <button
              type="button"
              class="schema-close"
              :title="$t('schema.close')"
              @click="store.closePanel()"
            >
              ×
            </button>
          </header>

          <div class="schema-split">
            <section class="schema-top">
              <div class="schema-search-row">
                <input
                  id="schema-search"
                  ref="searchInput"
                  v-model="store.search"
                  name="schema-search"
                  class="schema-input"
                  type="search"
                  :placeholder="$t('schema.searchPlaceholder')"
                  @keydown.enter="addFromSearch()"
                />
                <button type="button" class="toolbar-button" @click="addFromSearch()">
                  {{ $t('schema.add') }}
                </button>
              </div>
              <ul class="schema-list">
                <li
                  v-for="entry in store.filteredEntries"
                  :key="entry.mapping.url"
                  class="schema-item"
                  :class="{ active: entry.mapping.url === store.activeUrl }"
                  @click="store.select(entry.mapping.url)"
                >
                  <div class="schema-item-main">
                    <span class="schema-item-url" :title="entry.mapping.url">
                      {{ entry.mapping.url }}
                    </span>
                    <span v-if="entry.mapping.url === store.reference?.url" class="schema-tag">
                      {{ $t('schema.currentDocument') }}
                    </span>
                  </div>
                  <div class="schema-item-meta">
                    <span class="schema-state" :class="entry.valid ? 'ok' : 'bad'">
                      {{ entry.valid ? $t('schema.valid') : entry.message }}
                    </span>
                    <span class="schema-time">{{ formatTime(entry.mapping.updatedAt) }}</span>
                  </div>
                </li>
                <li v-if="store.filteredEntries.length === 0" class="schema-empty">
                  <template v-if="store.search.trim()">
                    <p>{{ $t('schema.noMatch') }}</p>
                    <button type="button" class="ghost-button" @click="addFromSearch">
                      {{ $t('schema.addNamed', { url: store.search.trim() }) }}
                    </button>
                  </template>
                  <p v-else>{{ $t('schema.empty') }}</p>
                </li>
              </ul>
            </section>

            <section class="schema-bottom">
              <div class="schema-detail">
                <div class="schema-detail-bar">
                  <input
                    v-if="store.activeMapping"
                    id="schema-url"
                    name="schema-url"
                    class="schema-input"
                    :value="store.activeMapping.url"
                    :title="$t('schema.editUrl')"
                    @change="onUrlChange"
                  />
                  <span v-else class="schema-placeholder">{{ $t('schema.noSelection') }}</span>
                  <button
                    v-if="store.activeMapping"
                    type="button"
                    class="toolbar-button"
                    @click="refetch()"
                  >
                    {{ $t('schema.fetch') }}
                  </button>
                  <button
                    v-if="store.activeMapping"
                    type="button"
                    class="toolbar-button danger"
                    @click="removeActive()"
                  >
                    {{ $t('schema.remove') }}
                  </button>
                </div>
                <div class="schema-editor-wrap">
                  <div ref="editorHost" class="schema-editor-host"></div>
                  <div v-if="!editorReady" class="schema-editor-overlay">
                    {{ $t('schema.editorLoading') }}
                  </div>
                  <div v-else-if="!store.activeMapping" class="schema-editor-overlay">
                    {{ $t('schema.editorHint') }}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.schema-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
  background: rgb(0 0 0 / 28%);
}

.schema-drawer {
  display: flex;
  flex-direction: column;
  width: min(580px, 94vw);
  height: 100%;
  min-height: 0;
  border-left: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.schema-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.schema-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.schema-title p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
}

.schema-close {
  flex: none;
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.schema-close:hover {
  color: var(--text);
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

.schema-split {
  display: grid;
  flex: 1;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 0;
}

.schema-top {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-bottom: 1px solid var(--border);
}

.schema-search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
}

.schema-search-row .schema-input {
  flex: 1;
  min-width: 0;
}

.schema-search-row .toolbar-button {
  flex: none;
}

.schema-input {
  width: 100%;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  font-size: 12.5px;
}

.schema-input:focus {
  outline: none;
  border-color: var(--accent);
}

.schema-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 4px 0;
  overflow: auto;
  list-style: none;
}

.schema-item {
  padding: 7px 12px;
  border-bottom: 1px solid var(--border-soft);
  cursor: pointer;
}

.schema-item:hover {
  background: var(--surface-hover);
}

.schema-item.active {
  background: var(--surface-active);
  box-shadow: inset 2px 0 0 var(--accent);
}

.schema-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.schema-item-url {
  overflow: hidden;
  font-size: 12.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.schema-tag {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 10.5px;
}

.schema-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-muted);
}

.schema-state.ok {
  color: var(--success);
}

.schema-state.bad {
  color: var(--warning);
}

.schema-bottom {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.schema-detail {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.schema-detail-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-soft);
}

.schema-detail-bar .schema-input {
  flex: 1;
  min-width: 0;
}

.schema-placeholder {
  flex: 1;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12.5px;
}

.schema-detail-bar .toolbar-button {
  flex: none;
}

.schema-editor-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.schema-editor-host {
  height: 100%;
}

.schema-editor-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12.5px;
  background: var(--surface);
}

.schema-empty {
  padding: 18px 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12.5px;
}

.schema-empty p {
  margin: 0 0 8px;
}

.schema-panel-enter-active,
.schema-panel-leave-active {
  transition: opacity 0.2s ease;
}

.schema-panel-enter-active .schema-drawer,
.schema-panel-leave-active .schema-drawer {
  transition: transform 0.22s ease;
}

.schema-panel-enter-from,
.schema-panel-leave-to {
  opacity: 0;
}

.schema-panel-enter-from .schema-drawer,
.schema-panel-leave-to .schema-drawer {
  transform: translateX(100%);
}
</style>
