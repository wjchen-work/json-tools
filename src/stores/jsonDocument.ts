import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  analyzeJson,
  formatJson,
  minifyJson,
  type IndentOption,
  type JsonAnalysis,
  type JsonIssue,
  type JsonStats,
  type JsonTreeNode,
  type TextPosition,
} from '@/utils/json'

export type ThemeMode = 'light' | 'dark'

export interface RevealTarget {
  start: TextPosition
  end: TextPosition
  nonce: number
}

export type SampleKind = 'valid' | 'broken'

const VALID_SAMPLE = `{
  "code": 0,
  "message": "success",
  "data": {
    "total": 3,
    "page": 1,
    "pageSize": 10,
    "users": [
      {
        "id": 1001,
        "name": "张三",
        "email": "zhangsan@example.com",
        "active": true,
        "roles": ["admin", "developer"],
        "profile": { "city": "杭州", "age": 28, "tags": ["vue", "typescript"] },
        "lastLoginAt": "2026-09-27T08:30:00Z"
      },
      {
        "id": 1002,
        "name": "李四",
        "email": "lisi@example.com",
        "active": false,
        "roles": ["viewer"],
        "profile": { "city": "成都", "age": 34, "tags": [] },
        "lastLoginAt": null
      }
    ],
    "config": {
      "retry": 3,
      "timeout": 15000,
      "endpoints": ["https://api.example.com/v1", "https://api.example.com/v2"]
    }
  }
}
`

const BROKEN_SAMPLE = `{
  "name": "示例",
  "version": 1.0.0,
  "tags": ["a", "b",],
  "nested": { "ok": true }
  "trailing": null,
}
`

const NOTICE_DURATION = 2600

export const useJsonDocumentStore = defineStore('jsonDocument', () => {
  const text = ref(VALID_SAMPLE)
  const indent = ref<IndentOption>(2)
  const theme = ref<ThemeMode>('light')
  const cursor = ref<TextPosition>({ line: 1, column: 1 })
  const selectionLength = ref(0)
  const reveal = ref<RevealTarget | null>(null)
  const notice = ref<string | null>(null)

  const analysis = computed<JsonAnalysis>(() => analyzeJson(text.value))
  const tree = computed<JsonTreeNode | null>(() =>
    analysis.value.status === 'valid' ? analysis.value.tree : null,
  )
  const stats = computed<JsonStats | null>(() =>
    analysis.value.status === 'valid' ? analysis.value.stats : null,
  )
  const issues = computed<JsonIssue[]>(() =>
    analysis.value.status === 'invalid' ? analysis.value.issues : [],
  )

  let noticeTimer: number | undefined

  function notify(message: string): void {
    notice.value = message
    if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => {
      notice.value = null
      noticeTimer = undefined
    }, NOTICE_DURATION)
  }

  function setText(next: string): void {
    if (next !== text.value) text.value = next
  }

  function setCursor(next: TextPosition): void {
    if (next.line !== cursor.value.line || next.column !== cursor.value.column) {
      cursor.value = next
    }
  }

  function setSelectionLength(next: number): void {
    if (next !== selectionLength.value) selectionLength.value = next
  }

  function setIndent(next: IndentOption): void {
    indent.value = next
  }

  function requestReveal(start: TextPosition, end: TextPosition = start): void {
    reveal.value = { start, end, nonce: (reveal.value?.nonce ?? 0) + 1 }
  }

  function replaceDocument(next: string): void {
    text.value = next
    selectionLength.value = 0
  }

  function transform(label: string, apply: (current: string) => string): void {
    const current = text.value
    const result = analyzeJson(current)
    if (result.status === 'empty') {
      notify(`内容为空，无需${label}`)
      return
    }
    if (result.status === 'invalid') {
      notify(`存在 ${result.issues.length} 处语法错误，修正后再${label}`)
      return
    }
    const next = apply(current)
    if (next === current) {
      notify(`内容已经是${label}后的结果`)
      return
    }
    text.value = next
    notify(`${label}完成`)
  }

  function format(): void {
    transform('格式化', (current) => formatJson(current, indent.value))
  }

  function minify(): void {
    transform('压缩', minifyJson)
  }

  function loadSample(kind: SampleKind): void {
    replaceDocument(kind === 'valid' ? VALID_SAMPLE : BROKEN_SAMPLE)
    notify(kind === 'valid' ? '已载入示例' : '已载入含语法错误的示例')
  }

  function clear(): void {
    replaceDocument('')
    notify('已清空')
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  return {
    text,
    indent,
    theme,
    cursor,
    selectionLength,
    reveal,
    notice,
    analysis,
    tree,
    stats,
    issues,
    notify,
    setText,
    setCursor,
    setSelectionLength,
    setIndent,
    requestReveal,
    replaceDocument,
    format,
    minify,
    loadSample,
    clear,
    toggleTheme,
  }
})
