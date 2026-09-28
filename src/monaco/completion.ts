import * as monaco from 'monaco-editor'
import { getLocation, type JSONPath } from 'jsonc-parser'
import { DOCUMENT_URI } from '@/monaco/uri'
import { useSchemaSupportStore } from '@/stores/schemaSupport'
import { collectPropertyKeys, existingKeysAt } from '@/utils/json'
import { findSchemaReference } from '@/utils/schema'

function escapeKey(key: string): string {
  return JSON.stringify(key).slice(1, -1)
}

function indentOf(model: monaco.editor.ITextModel): string {
  const options = model.getOptions()
  return options.insertSpaces ? ' '.repeat(options.tabSize) : '\t'
}

interface KeyEditContext {
  range: monaco.Range
  /** Adds the surrounding quotes only when the document does not already have them. */
  insertTextFor: (key: string) => string
}

/**
 * Monaco scores every suggestion against the text between the item range start and the cursor, so
 * the range must start *after* an opening quote. Otherwise the quote becomes part of the word and
 * no key can match it.
 */
function keyEditContext(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): KeyEditContext {
  const line = model.getLineContent(position.lineNumber)
  const cursorIndex = position.column - 1
  const word = model.getWordUntilPosition(position)

  let quoteIndex = -1
  for (let index = cursorIndex - 1; index >= 0; index -= 1) {
    const char = line.charAt(index)
    if (char === '"') {
      quoteIndex = index
      break
    }
    if (char === ':' || char === ',' || char === '{' || char === '[') break
  }

  if (quoteIndex < 0) {
    return {
      range: new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      ),
      insertTextFor: (key) => JSON.stringify(key),
    }
  }

  const closed = line.charAt(cursorIndex) === '"'
  return {
    range: new monaco.Range(
      position.lineNumber,
      quoteIndex + 2,
      position.lineNumber,
      closed ? position.column : Math.max(word.endColumn, position.column),
    ),
    insertTextFor: (key) => (closed ? escapeKey(key) : `${escapeKey(key)}"`),
  }
}

function isInsideString(model: monaco.editor.ITextModel, position: monaco.Position): boolean {
  const line = model.getLineContent(position.lineNumber)
  let inside = false
  for (let index = 0; index < position.column - 1; index += 1) {
    const char = line.charAt(index)
    if (inside && char === '\\') {
      index += 1
      continue
    }
    if (char === '"') inside = !inside
  }
  return inside
}

function keySuggestions(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  text: string,
  path: JSONPath,
): monaco.languages.CompletionItem[] {
  const { range, insertTextFor } = keyEditContext(model, position)
  const existing = existingKeysAt(text, path)
  const suggestions: monaco.languages.CompletionItem[] = []

  collectPropertyKeys(text).forEach((key, index) => {
    if (existing.has(key)) return
    suggestions.push({
      label: key,
      kind: monaco.languages.CompletionItemKind.Property,
      detail: '文档中的字段',
      insertText: insertTextFor(key),
      filterText: key,
      sortText: `0${String(index).padStart(4, '0')}`,
      range,
    })
  })

  return suggestions
}

function valueSuggestions(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): monaco.languages.CompletionItem[] {
  if (isInsideString(model, position)) return []

  const word = model.getWordUntilPosition(position)
  const range = new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn,
  )
  const indent = indentOf(model)

  const literals: monaco.languages.CompletionItem[] = ['null', 'true', 'false'].map(
    (keyword, index) => ({
      label: keyword,
      kind: monaco.languages.CompletionItemKind.Keyword,
      detail: '字面量',
      insertText: keyword,
      sortText: `2${String(index).padStart(4, '0')}`,
      range,
    }),
  )

  const snippets: monaco.languages.CompletionItem[] = [
    { label: '{}', body: `{\n${indent}$1\n}`, detail: '对象' },
    { label: '[]', body: `[\n${indent}$1\n]`, detail: '数组' },
    { label: '""', body: '"$1"', detail: '字符串' },
  ].map((snippet, index) => ({
    label: snippet.label,
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: snippet.detail,
    insertText: snippet.body,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    sortText: `3${String(index).padStart(4, '0')}`,
    range,
  }))

  return [...literals, ...snippets]
}

/** True when the document's `$schema` resolves to a schema registered with Monaco. */
function hasRegisteredSchema(text: string): boolean {
  const reference = findSchemaReference(text)
  if (!reference) return false
  return useSchemaSupportStore().schemas.some((entry) => entry.url === reference.url)
}

export function registerJsonCompletion(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider('json', {
    triggerCharacters: ['"', ':'],
    provideCompletionItems(model, position) {
      // Only the main document gets the document-aware suggestions; the schema content editor
      // falls back to Monaco's built-in JSON completion.
      if (model.uri.toString() !== DOCUMENT_URI) return { suggestions: [] }
      const text = model.getValue()
      // With a usable schema, Monaco's built-in JSON completion already offers the schema's
      // properties and values. Stay out of the way so candidates are not diluted with keys
      // collected from elsewhere in the document.
      if (hasRegisteredSchema(text)) return { suggestions: [] }
      const location = getLocation(text, model.getOffsetAt(position))
      if (!location.isAtPropertyKey) return { suggestions: valueSuggestions(model, position) }
      // At a key position the path ends with the key being typed, so drop it to get the
      // enclosing object whose existing keys should be hidden.
      return {
        suggestions: keySuggestions(model, position, text, location.path.slice(0, -1)),
      }
    },
  })
}
