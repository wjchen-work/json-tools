<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import JsonTreePanel from '@/components/JsonTreePanel.vue'
import ListViewPanel from '@/components/ListViewPanel.vue'
import MonacoJsonEditor from '@/components/MonacoJsonEditor.vue'
import ProblemsPanel from '@/components/ProblemsPanel.vue'
import SchemaPanel from '@/components/SchemaPanel.vue'
import { setLocale, type AppLocale } from '@/i18n'
import { useJsonDocumentStore } from '@/stores/jsonDocument'
import { useSchemaSupportStore } from '@/stores/schemaSupport'
import type { IndentOption } from '@/utils/json'

const FOLD_LEVELS = [2, 3, 4, 5, 6, 7]

const store = useJsonDocumentStore()
const schemaStore = useSchemaSupportStore()
const { t, locale } = useI18n()
const editorRef = ref<InstanceType<typeof MonacoJsonEditor> | null>(null)
const activeTab = ref<'tree' | 'problems'>('tree')
const fileInput = ref<HTMLInputElement | null>(null)

const localeOptions = computed(() => [
  { value: 'zh-CN' as const, label: t('app.locale.zhCN') },
  { value: 'en-US' as const, label: t('app.locale.enUS') },
])

watchEffect(() => {
  document.documentElement.dataset.theme = store.theme
})

const status = computed(() => {
  if (store.analysis.status === 'empty') return { kind: 'idle', text: t('status.empty') }
  if (store.analysis.status === 'invalid') {
    return { kind: 'error', text: t('status.errorCount', store.issues.length) }
  }
  return { kind: 'valid', text: t('status.valid') }
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function onFoldLevelChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  const level = Number(select.value)
  select.value = ''
  if (level >= 2) {
    editorRef.value?.foldLevel(level)
    editorRef.value?.focus()
  }
}

function onLocaleChange(event: Event): void {
  setLocale((event.target as HTMLSelectElement).value as AppLocale)
}

function onIndentChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  const next: IndentOption = value === 'tab' ? 'tab' : value === '4' ? 4 : 2
  store.setIndent(next)
}

async function copyDocument(): Promise<void> {
  if (store.text.length === 0) {
    store.notify('内容为空')
    return
  }
  try {
    await navigator.clipboard.writeText(store.text)
    store.notify('已复制到剪贴板')
  } catch {
    store.notify('复制失败，请手动选择后复制')
  }
}

function downloadDocument(): void {
  const blob = new Blob([store.text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'data.json'
  anchor.click()
  URL.revokeObjectURL(url)
  store.notify('已开始下载 data.json')
}

function pickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const content = await file.text()
  store.replaceDocument(content)
  store.notify(`已导入 ${file.name}`)
}
</script>

<template>
  <div class="app-shell">
    <header class="app-bar">
      <div class="app-brand">
        <img class="app-mark" src="/logo.svg" :alt="$t('app.title')" />
        <div>
          <h1>{{ $t('app.title') }}</h1>
          <p>{{ $t('app.tagline') }}</p>
        </div>
      </div>
      <div class="app-actions">
        <select
          id="locale-select"
          name="locale"
          class="select"
          :value="locale"
          :title="$t('app.locale.switchTo')"
          :aria-label="$t('app.locale.label')"
          @change="onLocaleChange"
        >
          <option v-for="item in localeOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        <button
          type="button"
          class="toolbar-button"
          :title="
            store.theme === 'light' ? $t('app.theme.switchToDark') : $t('app.theme.switchToLight')
          "
          @click="store.toggleTheme()"
        >
          {{ store.theme === 'light' ? $t('app.theme.dark') : $t('app.theme.light') }}
        </button>
      </div>
    </header>

    <div class="toolbar">
      <div class="toolbar-group">
        <button
          type="button"
          class="toolbar-button accent"
          :title="$t('toolbar.formatTitle')"
          @click="store.format()"
        >
          {{ $t('toolbar.format') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          :title="$t('toolbar.minifyTitle')"
          @click="store.minify()"
        >
          {{ $t('toolbar.minify') }}
        </button>
      </div>

      <div class="toolbar-group">
        <button type="button" class="toolbar-button" @click="editorRef?.foldAll()">
          {{ $t('toolbar.foldAll') }}
        </button>
        <button type="button" class="toolbar-button" @click="editorRef?.unfoldAll()">
          {{ $t('toolbar.unfoldAll') }}
        </button>
        <select
          id="fold-level"
          name="fold-level"
          class="select"
          :title="$t('toolbar.foldLevelTitle')"
          @change="onFoldLevelChange"
        >
          <option value="">{{ $t('toolbar.foldLevelPlaceholder') }}</option>
          <option v-for="level in FOLD_LEVELS" :key="level" :value="level">
            {{ $t('toolbar.foldLevel', { level }) }}
          </option>
        </select>
      </div>

      <div class="toolbar-group">
        <select
          id="indent"
          name="indent"
          class="select"
          :value="String(store.indent)"
          :title="$t('toolbar.indentTitle')"
          @change="onIndentChange"
        >
          <option value="2">{{ $t('toolbar.indent2') }}</option>
          <option value="4">{{ $t('toolbar.indent4') }}</option>
          <option value="tab">{{ $t('toolbar.indentTab') }}</option>
        </select>
      </div>

      <div class="toolbar-group">
        <button
          type="button"
          class="toolbar-button"
          :title="$t('toolbar.schemaMappingTitle')"
          @click="schemaStore.openPanel()"
        >
          {{ $t('toolbar.schemaMapping') }}
          <span v-if="schemaStore.warnings.length > 0" class="tab-badge warn">
            {{ schemaStore.warnings.length }}
          </span>
        </button>
      </div>

      <div class="toolbar-group toolbar-group-end">
        <button type="button" class="toolbar-button" @click="copyDocument()">
          {{ $t('toolbar.copy') }}
        </button>
        <button type="button" class="toolbar-button" @click="downloadDocument()">
          {{ $t('toolbar.download') }}
        </button>
        <button type="button" class="toolbar-button" @click="pickFile()">
          {{ $t('toolbar.import') }}
        </button>
        <button type="button" class="toolbar-button" @click="store.loadSample('valid')">
          {{ $t('toolbar.sample') }}
        </button>
        <button type="button" class="toolbar-button" @click="store.loadSample('broken')">
          {{ $t('toolbar.sampleBroken') }}
        </button>
        <button type="button" class="toolbar-button danger" @click="store.clear()">
          {{ $t('toolbar.clear') }}
        </button>
      </div>

      <input
        id="file-input"
        ref="fileInput"
        name="file"
        class="hidden-input"
        type="file"
        accept=".json,.txt,application/json,text/plain"
        @change="onFileChange"
      />
    </div>

    <main class="workspace">
      <section class="editor-pane">
        <MonacoJsonEditor ref="editorRef" />
      </section>

      <aside class="side-pane">
        <div class="tabs">
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'tree' }"
            @click="activeTab = 'tree'"
          >
            {{ $t('tabs.tree') }}
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'problems' }"
            @click="activeTab = 'problems'"
          >
            {{ $t('tabs.problems') }}
            <span v-if="store.issues.length > 0" class="tab-badge error">
              {{ store.issues.length }}
            </span>
          </button>
        </div>
        <div class="tab-body">
          <JsonTreePanel v-show="activeTab === 'tree'" :visible="activeTab === 'tree'" />
          <ProblemsPanel v-show="activeTab === 'problems'" />
        </div>
      </aside>
    </main>

    <footer class="status-bar">
      <div class="status-group">
        <span>{{
          $t('status.cursor', { line: store.cursor.line, column: store.cursor.column })
        }}</span>
        <span v-if="store.selectionLength > 0">
          {{ $t('status.selectedChars', store.selectionLength) }}
        </span>
      </div>
      <div class="status-group status-group-center">
        <template v-if="store.stats">
          <span>{{ $t('status.lines', store.stats.lines) }}</span>
          <span>{{ $t('status.characters', store.stats.characters) }}</span>
          <span>{{ formatBytes(store.stats.bytes) }}</span>
          <span>{{ $t('status.values', store.stats.values) }}</span>
          <span>{{ $t('status.depth', { depth: store.stats.depth }) }}</span>
        </template>
        <span v-else>—</span>
      </div>
      <div class="status-group status-group-end">
        <span class="status-badge" :class="status.kind">{{ status.text }}</span>
      </div>
    </footer>

    <Transition name="toast">
      <div v-if="store.notice" class="toast">{{ store.notice }}</div>
    </Transition>

    <SchemaPanel />
    <ListViewPanel />
  </div>
</template>
