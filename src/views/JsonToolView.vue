<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import JsonTreePanel from '@/components/JsonTreePanel.vue'
import MonacoJsonEditor from '@/components/MonacoJsonEditor.vue'
import ProblemsPanel from '@/components/ProblemsPanel.vue'
import { useJsonDocumentStore } from '@/stores/jsonDocument'
import type { IndentOption } from '@/utils/json'

const FOLD_LEVELS = [2, 3, 4, 5, 6, 7]

const store = useJsonDocumentStore()
const editorRef = ref<InstanceType<typeof MonacoJsonEditor> | null>(null)
const activeTab = ref<'tree' | 'problems'>('tree')
const fileInput = ref<HTMLInputElement | null>(null)

watchEffect(() => {
  document.documentElement.dataset.theme = store.theme
})

const status = computed(() => {
  if (store.analysis.status === 'empty') return { kind: 'idle', text: '空文档' }
  if (store.analysis.status === 'invalid') {
    return { kind: 'error', text: `${store.issues.length} 个错误` }
  }
  return { kind: 'valid', text: 'JSON 有效' }
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
        <span class="app-mark">{ }</span>
        <div>
          <h1>JSON 工具</h1>
          <p>格式化 · 压缩 · 校验 · 结构导航</p>
        </div>
      </div>
      <button
        type="button"
        class="toolbar-button"
        :title="store.theme === 'light' ? '切换到深色主题' : '切换到浅色主题'"
        @click="store.toggleTheme()"
      >
        {{ store.theme === 'light' ? '深色' : '浅色' }}
      </button>
    </header>

    <div class="toolbar">
      <div class="toolbar-group">
        <button
          type="button"
          class="toolbar-button accent"
          title="格式化（Ctrl+Shift+F）"
          @click="store.format()"
        >
          格式化
        </button>
        <button
          type="button"
          class="toolbar-button"
          title="压缩为单行（Ctrl+Shift+M）"
          @click="store.minify()"
        >
          压缩
        </button>
      </div>

      <div class="toolbar-group">
        <button type="button" class="toolbar-button" @click="editorRef?.foldAll()">折叠全部</button>
        <button type="button" class="toolbar-button" @click="editorRef?.unfoldAll()">
          展开全部
        </button>
        <select class="select" title="折叠到指定层级" @change="onFoldLevelChange">
          <option value="">折叠到层级…</option>
          <option v-for="level in FOLD_LEVELS" :key="level" :value="level">
            第 {{ level }} 层
          </option>
        </select>
      </div>

      <div class="toolbar-group">
        <select
          class="select"
          :value="String(store.indent)"
          title="缩进方式"
          @change="onIndentChange"
        >
          <option value="2">缩进：2 空格</option>
          <option value="4">缩进：4 空格</option>
          <option value="tab">缩进：Tab</option>
        </select>
      </div>

      <div class="toolbar-group toolbar-group-end">
        <button type="button" class="toolbar-button" @click="copyDocument()">复制</button>
        <button type="button" class="toolbar-button" @click="downloadDocument()">下载</button>
        <button type="button" class="toolbar-button" @click="pickFile()">导入</button>
        <button type="button" class="toolbar-button" @click="store.loadSample('valid')">
          示例
        </button>
        <button type="button" class="toolbar-button" @click="store.loadSample('broken')">
          错误示例
        </button>
        <button type="button" class="toolbar-button danger" @click="store.clear()">清空</button>
      </div>

      <input
        ref="fileInput"
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
            结构
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: activeTab === 'problems' }"
            @click="activeTab = 'problems'"
          >
            问题
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
        <span>行 {{ store.cursor.line }}，列 {{ store.cursor.column }}</span>
        <span v-if="store.selectionLength > 0">已选 {{ store.selectionLength }} 字符</span>
      </div>
      <div class="status-group status-group-center">
        <template v-if="store.stats">
          <span>{{ store.stats.lines }} 行</span>
          <span>{{ store.stats.characters }} 字符</span>
          <span>{{ formatBytes(store.stats.bytes) }}</span>
          <span>{{ store.stats.values }} 个值</span>
          <span>深度 {{ store.stats.depth }}</span>
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
  </div>
</template>
