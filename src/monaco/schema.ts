import * as monaco from 'monaco-editor'
import { DOCUMENT_URI } from '@/monaco/uri'
import { useSchemaSupportStore } from '@/stores/schemaSupport'

export const OPEN_SCHEMA_MAPPING_COMMAND = 'json-tools.openSchemaMapping'

function positionBefore(left: monaco.Position, right: monaco.Position): boolean {
  if (left.lineNumber !== right.lineNumber) return left.lineNumber < right.lineNumber
  return left.column <= right.column
}

function rangesOverlap(range: monaco.Range, start: monaco.Position, end: monaco.Position): boolean {
  const rangeStart = range.getStartPosition()
  const rangeEnd = range.getEndPosition()
  return positionBefore(rangeStart, end) && positionBefore(start, rangeEnd)
}

/**
 * Attaches the "手动填写 $schema 内容" quick fix to schema fetch warnings. The code action opens
 * the mapping panel with the failing URL preselected, which is the manual escape hatch for CORS.
 */
export function registerSchemaSupport(): void {
  monaco.editor.registerCommand(OPEN_SCHEMA_MAPPING_COMMAND, (_accessor, url?: unknown) => {
    useSchemaSupportStore().openPanel(typeof url === 'string' ? url : undefined)
  })

  monaco.languages.registerCodeActionProvider(
    'json',
    {
      provideCodeActions(model, range) {
        if (model.uri.toString() !== DOCUMENT_URI) return { actions: [], dispose: () => undefined }
        const store = useSchemaSupportStore()
        const actions: monaco.languages.CodeAction[] = []
        for (const warning of store.warnings) {
          const start = model.getPositionAt(warning.offset)
          const end = model.getPositionAt(
            Math.min(warning.offset + Math.max(warning.length, 1), model.getValueLength()),
          )
          if (!rangesOverlap(range, start, end)) continue
          actions.push({
            title: '手动填写 $schema 内容',
            kind: 'quickfix',
            isPreferred: true,
            command: {
              id: OPEN_SCHEMA_MAPPING_COMMAND,
              title: '打开 $schema 内容映射',
              arguments: [warning.url],
            },
          })
        }
        return { actions, dispose: () => undefined }
      },
    },
    { providedCodeActionKinds: ['quickfix'] },
  )
}
