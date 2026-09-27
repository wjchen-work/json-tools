import {
  applyEdits,
  findNodeAtLocation,
  format as computeFormatEdits,
  parseTree,
  type JSONPath,
  type Node,
  type ParseError,
  type ParseOptions,
} from 'jsonc-parser'

/** Strict JSON: comments and trailing commas are reported as errors. */
export const STRICT_JSON_OPTIONS: ParseOptions = {
  disallowComments: true,
  allowTrailingComma: false,
  allowEmptyContent: true,
}

export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export type IndentOption = 2 | 4 | 'tab'

export interface TextPosition {
  /** 1-based line number. */
  line: number
  /** 1-based column number. */
  column: number
}

export interface JsonIssue extends TextPosition {
  message: string
  offset: number
  length: number
}

export interface JsonTreeNode {
  /** Stable path-based identity, e.g. `$.items[0].name`. */
  id: string
  /** Property name, array index, or `null` for the document root. */
  key: string | null
  /** True when the node sits at an array index rather than under an object key. */
  isArrayItem: boolean
  kind: JsonKind
  /** Single-line preview of the node's source text. */
  preview: string
  childCount: number
  offset: number
  length: number
  start: TextPosition
  end: TextPosition
  children: JsonTreeNode[]
}

export interface JsonStats {
  characters: number
  bytes: number
  lines: number
  values: number
  depth: number
  rootKind: JsonKind
}

export type JsonAnalysis =
  | { status: 'empty' }
  | { status: 'invalid'; issues: JsonIssue[] }
  | { status: 'valid'; tree: JsonTreeNode; stats: JsonStats }

/** jsonc-parser reports error codes as numbers; keep them out of the type system. */
const PARSE_ERROR_MESSAGES: Record<number, string> = {
  1: '无效的符号',
  2: '数字格式不正确',
  3: '此处应为属性名，且必须使用双引号',
  4: '此处应为合法的 JSON 值',
  5: '属性名后缺少冒号 ":"',
  6: '缺少逗号 ","',
  7: '缺少右花括号 "}"',
  8: '缺少右方括号 "]"',
  9: '此处应为文档结尾，存在多余内容',
  10: 'JSON 标准不支持注释',
  11: '注释未正确结束',
  12: '字符串未正确结束',
  13: '数字未正确结束',
  14: '无效的 Unicode 转义序列',
  15: '无效的转义字符',
  16: '无效的字符',
}

export type PositionResolver = (offset: number) => TextPosition

export function createPositionResolver(text: string): PositionResolver {
  const lineStarts: number[] = [0]
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code === 10) {
      lineStarts.push(index + 1)
    } else if (code === 13) {
      if (text.charCodeAt(index + 1) === 10) index += 1
      lineStarts.push(index + 1)
    }
  }
  return (offset: number): TextPosition => {
    const clamped = Math.min(Math.max(offset, 0), text.length)
    let low = 0
    let high = lineStarts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if ((lineStarts[mid] ?? 0) <= clamped) low = mid
      else high = mid - 1
    }
    return { line: low + 1, column: clamped - (lineStarts[low] ?? 0) + 1 }
  }
}

export function utf8ByteLength(text: string): number {
  let bytes = 0
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4
      index += 1
    } else bytes += 3
  }
  return bytes
}

export function countLines(text: string): number {
  if (text.length === 0) return 1
  let lines = 1
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code === 10) lines += 1
    else if (code === 13) {
      lines += 1
      if (text.charCodeAt(index + 1) === 10) index += 1
    }
  }
  return lines
}

const PREVIEW_SOURCE_LIMIT = 160
const PREVIEW_LIMIT = 60

function previewOf(text: string, node: Node): string {
  const end = Math.min(node.offset + node.length, node.offset + PREVIEW_SOURCE_LIMIT)
  const compact = text.slice(node.offset, end).replace(/\s+/g, ' ').trim()
  return compact.length > PREVIEW_LIMIT ? `${compact.slice(0, PREVIEW_LIMIT - 1)}…` : compact
}

/** Property nodes are consumed by their parent object, so they never reach the tree. */
function kindOf(node: Node): JsonKind {
  return node.type === 'property' ? 'object' : node.type
}

function buildTreeNode(
  node: Node,
  key: string | null,
  path: string,
  resolve: PositionResolver,
  text: string,
  isArrayItem: boolean,
): JsonTreeNode {
  const children: JsonTreeNode[] = []
  if (node.type === 'object') {
    for (const property of node.children ?? []) {
      const [keyNode, valueNode] = property.children ?? []
      if (!valueNode) continue
      const name = typeof keyNode?.value === 'string' ? keyNode.value : ''
      children.push(buildTreeNode(valueNode, name, `${path}.${name}`, resolve, text, false))
    }
  } else if (node.type === 'array') {
    for (const [index, item] of (node.children ?? []).entries()) {
      children.push(buildTreeNode(item, String(index), `${path}[${index}]`, resolve, text, true))
    }
  }
  return {
    id: path,
    key,
    isArrayItem,
    kind: kindOf(node),
    preview: previewOf(text, node),
    childCount: children.length,
    offset: node.offset,
    length: node.length,
    start: resolve(node.offset),
    end: resolve(node.offset + node.length),
    children,
  }
}

function computeStats(text: string, tree: JsonTreeNode): JsonStats {
  let values = 0
  let depth = 0
  const stack: { node: JsonTreeNode; level: number }[] = [{ node: tree, level: 1 }]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) break
    values += 1
    if (current.level > depth) depth = current.level
    for (const child of current.node.children) {
      stack.push({ node: child, level: current.level + 1 })
    }
  }
  return {
    characters: text.length,
    bytes: utf8ByteLength(text),
    lines: countLines(text),
    values,
    depth,
    rootKind: tree.kind,
  }
}

function toIssue(error: ParseError, resolve: PositionResolver): JsonIssue {
  return {
    message: PARSE_ERROR_MESSAGES[error.error] ?? 'JSON 语法错误',
    offset: error.offset,
    length: error.length,
    ...resolve(error.offset),
  }
}

export function analyzeJson(text: string): JsonAnalysis {
  if (text.trim().length === 0) return { status: 'empty' }

  const errors: ParseError[] = []
  const root = parseTree(text, errors, STRICT_JSON_OPTIONS)
  const resolve = createPositionResolver(text)

  if (!root) {
    return {
      status: 'invalid',
      issues:
        errors.length > 0
          ? errors.map((error) => toIssue(error, resolve))
          : [{ message: '无法解析为 JSON', offset: 0, length: 0, line: 1, column: 1 }],
    }
  }
  if (errors.length > 0) {
    return { status: 'invalid', issues: errors.map((error) => toIssue(error, resolve)) }
  }

  const tree = buildTreeNode(root, null, '$', resolve, text, false)
  return { status: 'valid', tree, stats: computeStats(text, tree) }
}

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

/** Re-indents the document without touching token text, so number literals keep their spelling. */
export function formatJson(text: string, indent: IndentOption): string {
  if (text.trim().length === 0) return text
  return applyEdits(
    text,
    computeFormatEdits(text, undefined, {
      tabSize: indent === 'tab' ? 2 : indent,
      insertSpaces: indent !== 'tab',
      insertFinalNewline: true,
      keepLines: false,
      eol: detectEol(text),
    }),
  )
}

/** Removes every whitespace run outside of string literals. Input must be valid JSON. */
export function minifyJson(text: string): string {
  let output = ''
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index)
    if (inString) {
      output += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      output += char
      continue
    }
    const code = text.charCodeAt(index)
    if (code === 32 || code === 9 || code === 10 || code === 13) continue
    output += char
  }
  return output
}

/**
 * What a user expects when copying a single tree node:
 * scalars yield their bare value (strings lose the quotes and get unescaped), while
 * objects and arrays yield their full JSON source. Numbers keep their original spelling.
 */
export function nodeCopyValue(text: string, node: JsonTreeNode): string {
  const source = text.slice(node.offset, node.offset + node.length)
  if (node.kind !== 'string') return source
  // `source` is a validated JSON string literal, so decoding it is safe here.
  try {
    return JSON.parse(source) as string
  } catch {
    return source
  }
}

/** A tabular projection of an array node, ready to render as `<table>`. */
export interface JsonTable {
  columns: string[]
  rows: string[][]
}

/** Locates a node by its path-based `id` without walking branches that cannot contain it. */
export function findTreeNodeById(root: JsonTreeNode, id: string): JsonTreeNode | null {
  if (root.id === id) return root
  for (const child of root.children) {
    // Child ids always extend their parent's id, so unrelated branches can be skipped.
    if (id.startsWith(child.id) || child.id.startsWith(id)) {
      const found = findTreeNodeById(child, id)
      if (found) return found
    }
  }
  return null
}

/** Scalars keep their copy value; objects and arrays collapse to one-line JSON. */
function renderCellValue(text: string, node: JsonTreeNode): string {
  const raw = nodeCopyValue(text, node)
  return node.children.length > 0 ? minifyJson(raw) : raw
}

/**
 * Projects an array node onto a table. Arrays of objects share one column per property key
 * (first appearance wins); anything else becomes a single column named after the array path.
 */
export function buildArrayTable(text: string, node: JsonTreeNode): JsonTable {
  const items = node.children
  if (items.length === 0) return { columns: [], rows: [] }

  const allObjects = items.every((item) => item.kind === 'object')
  if (!allObjects) {
    return {
      columns: [node.id],
      rows: items.map((item) => [renderCellValue(text, item)]),
    }
  }

  const columns: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    for (const child of item.children) {
      const name = child.key ?? ''
      if (!seen.has(name)) {
        seen.add(name)
        columns.push(name)
      }
    }
  }

  const rows = items.map((item) => {
    const byKey = new Map<string, JsonTreeNode>()
    for (const child of item.children) byKey.set(child.key ?? '', child)
    return columns.map((column) => {
      const child = byKey.get(column)
      return child ? renderCellValue(text, child) : ''
    })
  })

  return { columns, rows }
}

/** Property names used anywhere in the document, most frequent first. */
export function collectPropertyKeys(text: string): string[] {
  const root = parseTree(text, undefined, STRICT_JSON_OPTIONS)
  const counts = new Map<string, number>()
  const visit = (node: Node): void => {
    if (node.type === 'object') {
      for (const property of node.children ?? []) {
        const [keyNode, valueNode] = property.children ?? []
        // An empty name is a half-typed key, not something worth suggesting.
        if (typeof keyNode?.value === 'string' && keyNode.value.length > 0) {
          counts.set(keyNode.value, (counts.get(keyNode.value) ?? 0) + 1)
        }
        if (valueNode) visit(valueNode)
      }
      return
    }
    if (node.type === 'array') {
      for (const item of node.children ?? []) visit(item)
    }
  }
  if (root) visit(root)
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key]) => key)
}

/** Property names already present in the object at `path`, used to hide redundant completions. */
export function existingKeysAt(text: string, path: JSONPath): Set<string> {
  const keys = new Set<string>()
  const root = parseTree(text, undefined, STRICT_JSON_OPTIONS)
  if (!root) return keys
  const node = findNodeAtLocation(root, path)
  if (node?.type !== 'object') return keys
  for (const property of node.children ?? []) {
    const keyNode = property.children?.[0]
    if (typeof keyNode?.value === 'string' && keyNode.value.length > 0) keys.add(keyNode.value)
  }
  return keys
}
