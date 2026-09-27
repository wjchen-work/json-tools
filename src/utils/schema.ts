import { parse, parseTree, type ParseError } from 'jsonc-parser'
import { createPositionResolver, type TextPosition } from '@/utils/json'

export interface SchemaReference extends TextPosition {
  /** Raw `$schema` value, used as the schema's identifier. */
  url: string
  offset: number
  length: number
}

export type SchemaParseResult = { ok: true; value: unknown } | { ok: false; message: string }

/**
 * Reads the root-level `$schema` URL. Parsing stays lenient on purpose: a document that already
 * has syntax errors should still surface its schema so the completion/warning flow keeps working.
 */
export function findSchemaReference(text: string): SchemaReference | null {
  if (text.trim().length === 0) return null
  const root = parseTree(text, undefined, { allowTrailingComma: true })
  if (root?.type !== 'object') return null
  for (const property of root.children ?? []) {
    const [keyNode, valueNode] = property.children ?? []
    if (keyNode?.value !== '$schema' || valueNode?.type !== 'string') continue
    const url = typeof valueNode.value === 'string' ? valueNode.value.trim() : ''
    if (url.length === 0) return null
    const resolve = createPositionResolver(text)
    return {
      url,
      offset: valueNode.offset,
      length: valueNode.length,
      ...resolve(valueNode.offset),
    }
  }
  return null
}

/**
 * Parses schema content that is handed to Monaco. This is not the user's document, so a plain
 * strict parse is exactly what we want: comments and trailing commas make a schema unusable.
 */
export function parseSchemaDocument(content: string): SchemaParseResult {
  const normalized = content.replace(/^\uFEFF/, '')
  if (normalized.trim().length === 0) return { ok: false, message: '内容为空' }

  const errors: ParseError[] = []
  const value = parse(normalized, errors, { disallowComments: true, allowTrailingComma: false })
  if (errors.length > 0) return { ok: false, message: '不是合法的 JSON' }
  return { ok: true, value }
}
