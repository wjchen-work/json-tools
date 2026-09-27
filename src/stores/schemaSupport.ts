import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useJsonDocumentStore } from '@/stores/jsonDocument'
import { findSchemaReference, parseSchemaDocument, type SchemaReference } from '@/utils/schema'
import type { TextPosition } from '@/utils/json'

export interface SchemaMapping {
  /** The `$schema` URL, also the key the content is registered under. */
  url: string
  content: string
  updatedAt: number
}

export interface SchemaMappingEntry {
  mapping: SchemaMapping
  valid: boolean
  message: string
  value: unknown
}

export interface RegisteredSchema {
  url: string
  schema: unknown
}

export interface SchemaWarning extends TextPosition {
  url: string
  offset: number
  length: number
  message: string
}

export type SchemaStatus = 'idle' | 'mapped' | 'loading' | 'ready' | 'error'

const STORAGE_KEY = 'json-tools:schema-mappings'
/** Wait for the URL to settle before hitting the network while the user is still typing. */
const RESOLVE_DELAY = 350
const PERSIST_DELAY = 250

interface FetchedSchema {
  value: unknown
  content: string
}

type FetchResult = { ok: true; schema: unknown } | { ok: false; message: string }

function loadMappings(): SchemaMapping[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const mappings: SchemaMapping[] = []
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue
      const record = entry as Record<string, unknown>
      const url = typeof record.url === 'string' ? record.url.trim() : ''
      if (url.length === 0) continue
      mappings.push({
        url,
        content: typeof record.content === 'string' ? record.content : '',
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
      })
    }
    return mappings
  } catch {
    // Corrupted or unavailable storage should not break the app; start from an empty registry.
    return []
  }
}

export const useSchemaSupportStore = defineStore('schemaSupport', () => {
  const documentStore = useJsonDocumentStore()

  const mappings = ref<SchemaMapping[]>(loadMappings())
  const panelOpen = ref(false)
  const search = ref('')
  const activeUrl = ref<string | null>(null)

  const reference = ref<SchemaReference | null>(null)
  const status = ref<SchemaStatus>('idle')
  const statusMessage = ref('')
  const fetched = ref<RegisteredSchema | null>(null)

  /** Successful and failed fetches, keyed by URL, so typing does not retrigger the network. */
  const results = new Map<string, FetchResult>()
  let fetchToken = 0
  let resolveTimer: number | undefined
  let persistTimer: number | undefined

  const entries = computed<SchemaMappingEntry[]>(() =>
    mappings.value.map((mapping) => {
      const parsed = parseSchemaDocument(mapping.content)
      return {
        mapping,
        valid: parsed.ok,
        message: parsed.ok ? '' : parsed.message,
        value: parsed.ok ? parsed.value : undefined,
      }
    }),
  )

  const filteredEntries = computed<SchemaMappingEntry[]>(() => {
    const keyword = search.value.trim().toLowerCase()
    if (keyword.length === 0) return entries.value
    return entries.value.filter((entry) => entry.mapping.url.toLowerCase().includes(keyword))
  })

  const activeMapping = computed<SchemaMapping | null>(
    () => mappings.value.find((mapping) => mapping.url === activeUrl.value) ?? null,
  )

  const activeEntry = computed<SchemaMappingEntry | null>(
    () => entries.value.find((entry) => entry.mapping.url === activeUrl.value) ?? null,
  )

  /** Every mapping that parses, plus the schema fetched for the current document. */
  const schemas = computed<RegisteredSchema[]>(() => {
    const list: RegisteredSchema[] = []
    const seen = new Set<string>()
    for (const entry of entries.value) {
      if (!entry.valid || seen.has(entry.mapping.url)) continue
      list.push({ url: entry.mapping.url, schema: entry.value })
      seen.add(entry.mapping.url)
    }
    if (fetched.value && !seen.has(fetched.value.url)) list.push(fetched.value)
    return list
  })

  const warnings = computed<SchemaWarning[]>(() => {
    const current = reference.value
    if (!current) return []
    const entry = entries.value.find((item) => item.mapping.url === current.url)
    if (entry) {
      if (entry.valid) return []
      return [{ ...current, message: `映射内容无法用于补全：${entry.message}` }]
    }
    if (status.value === 'error') return [{ ...current, message: statusMessage.value }]
    return []
  })

  function persist(): void {
    if (persistTimer !== undefined) window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(() => {
      persistTimer = undefined
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings.value))
      } catch {
        // Quota or private-mode failures are non-fatal: the panel keeps working in memory.
      }
    }, PERSIST_DELAY)
  }

  function select(url: string | null): void {
    activeUrl.value = url
  }

  function openPanel(url?: string): void {
    panelOpen.value = true
    // Fall back to the document's `$schema` so opening the panel from a warning immediately
    // targets the URL that needs manual content.
    const explicit = url?.trim() || reference.value?.url || ''
    if (explicit) {
      if (!mappings.value.some((mapping) => mapping.url === explicit)) {
        mappings.value.push({ url: explicit, content: '', updatedAt: Date.now() })
        persist()
      }
      activeUrl.value = explicit
      return
    }
    if (!activeUrl.value || !mappings.value.some((mapping) => mapping.url === activeUrl.value)) {
      activeUrl.value = mappings.value[0]?.url ?? null
    }
  }

  function closePanel(): void {
    panelOpen.value = false
  }

  function addMapping(url: string): { ok: boolean; message: string } {
    const trimmed = url.trim()
    if (trimmed.length === 0) return { ok: false, message: '请输入 URL' }
    if (mappings.value.some((mapping) => mapping.url === trimmed)) {
      activeUrl.value = trimmed
      return { ok: false, message: '该 URL 已存在' }
    }
    mappings.value.push({ url: trimmed, content: '', updatedAt: Date.now() })
    activeUrl.value = trimmed
    persist()
    return { ok: true, message: '已新增映射' }
  }

  function renameMapping(previous: string, next: string): { ok: boolean; message: string } {
    const trimmed = next.trim()
    if (trimmed.length === 0) return { ok: false, message: 'URL 不能为空' }
    if (trimmed === previous) return { ok: true, message: '' }
    if (mappings.value.some((mapping) => mapping.url === trimmed)) {
      return { ok: false, message: '该 URL 已存在' }
    }
    const index = mappings.value.findIndex((mapping) => mapping.url === previous)
    const existing = mappings.value[index]
    if (index < 0 || !existing) return { ok: false, message: '映射不存在' }
    mappings.value.splice(index, 1, { ...existing, url: trimmed, updatedAt: Date.now() })
    activeUrl.value = trimmed
    persist()
    return { ok: true, message: '已更新 URL' }
  }

  function removeMapping(url: string): void {
    const index = mappings.value.findIndex((mapping) => mapping.url === url)
    if (index < 0) return
    mappings.value.splice(index, 1)
    if (activeUrl.value === url) activeUrl.value = mappings.value[0]?.url ?? null
    persist()
  }

  function setContent(url: string, content: string): void {
    const index = mappings.value.findIndex((mapping) => mapping.url === url)
    const existing = mappings.value[index]
    if (index < 0 || !existing || existing.content === content) return
    mappings.value.splice(index, 1, { ...existing, content, updatedAt: Date.now() })
    persist()
  }

  function warningMessage(reason: string): string {
    return `无法自动获取 $schema 内容（${reason}）。可点击灯泡选择“手动填写 $schema 内容”，或在“$schema 映射”面板中粘贴内容。`
  }

  async function requestSchema(url: string): Promise<FetchedSchema> {
    const response = await fetch(url, {
      headers: { Accept: 'application/json, text/plain, */*' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const content = await response.text()
    const parsed = parseSchemaDocument(content)
    if (!parsed.ok) throw new Error(`返回内容不是合法 JSON（${parsed.message}）`)
    return { value: parsed.value, content }
  }

  function applyResult(url: string, result: FetchResult): void {
    if (result.ok) {
      fetched.value = { url, schema: result.schema }
      status.value = 'ready'
      statusMessage.value = ''
    } else {
      fetched.value = null
      status.value = 'error'
      statusMessage.value = warningMessage(result.message)
    }
  }

  async function resolveNow(): Promise<void> {
    const current = findSchemaReference(documentStore.text)
    reference.value = current
    if (!current) {
      fetched.value = null
      status.value = 'idle'
      statusMessage.value = ''
      return
    }
    if (mappings.value.some((mapping) => mapping.url === current.url)) {
      fetched.value = null
      status.value = 'mapped'
      statusMessage.value = ''
      return
    }
    // Relative or malformed values cannot be requested from the browser; wait for a real URL.
    if (!/^https?:\/\//i.test(current.url)) {
      fetched.value = null
      status.value = 'idle'
      statusMessage.value = ''
      return
    }

    const cached = results.get(current.url)
    if (cached) {
      applyResult(current.url, cached)
      return
    }

    status.value = 'loading'
    statusMessage.value = ''
    const token = ++fetchToken
    try {
      const result = await requestSchema(current.url)
      const stored: FetchResult = { ok: true, schema: result.value }
      results.set(current.url, stored)
      if (token !== fetchToken || reference.value?.url !== current.url) return
      applyResult(current.url, stored)
    } catch (error) {
      const message = error instanceof Error ? error.message : '拉取失败'
      const stored: FetchResult = { ok: false, message }
      results.set(current.url, stored)
      if (token !== fetchToken || reference.value?.url !== current.url) return
      applyResult(current.url, stored)
    }
  }

  function scheduleResolve(): void {
    if (resolveTimer !== undefined) window.clearTimeout(resolveTimer)
    resolveTimer = window.setTimeout(() => {
      resolveTimer = undefined
      void resolveNow()
    }, RESOLVE_DELAY)
  }

  /** Fetches a URL from the panel and stores the raw response as its mapping content. */
  async function fetchIntoMapping(url: string): Promise<{ ok: boolean; message: string }> {
    const trimmed = url.trim()
    if (trimmed.length === 0) return { ok: false, message: 'URL 为空' }
    try {
      const result = await requestSchema(trimmed)
      const stored: FetchResult = { ok: true, schema: result.value }
      results.set(trimmed, stored)
      setContent(trimmed, result.content)
      if (reference.value?.url === trimmed) applyResult(trimmed, stored)
      return { ok: true, message: '已拉取并缓存 schema 内容' }
    } catch (error) {
      const message = error instanceof Error ? error.message : '拉取失败'
      const stored: FetchResult = { ok: false, message }
      results.set(trimmed, stored)
      if (reference.value?.url === trimmed) applyResult(trimmed, stored)
      return { ok: false, message: `拉取失败：${message}` }
    }
  }

  watch(() => documentStore.text, scheduleResolve, { immediate: true })

  return {
    mappings,
    panelOpen,
    search,
    activeUrl,
    reference,
    status,
    statusMessage,
    entries,
    filteredEntries,
    activeMapping,
    activeEntry,
    schemas,
    warnings,
    select,
    openPanel,
    closePanel,
    addMapping,
    renameMapping,
    removeMapping,
    setContent,
    resolveNow,
    fetchIntoMapping,
  }
})
