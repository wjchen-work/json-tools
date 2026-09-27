<script setup lang="ts">
import type * as Monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MONACO_THEME } from '@/monaco/theme'
import { DOCUMENT_URI } from '@/monaco/uri'
import { useJsonDocumentStore } from '@/stores/jsonDocument'
import { useSchemaSupportStore, type SchemaWarning } from '@/stores/schemaSupport'
import type { IndentOption, JsonIssue } from '@/utils/json'

type MonacoApi = typeof import('monaco-editor')

const MARKER_OWNER = 'json-tools'

const store = useJsonDocumentStore()
const schemaStore = useSchemaSupportStore()
const host = ref<HTMLDivElement | null>(null)
const ready = ref(false)

let editor: Monaco.editor.IStandaloneCodeEditor | null = null
let model: Monaco.editor.ITextModel | null = null
const disposables: Monaco.IDisposable[] = []
const stopHandles: (() => void)[] = []

function indentOptions(indent: IndentOption): { tabSize: number; insertSpaces: boolean } {
  return { tabSize: indent === 'tab' ? 2 : indent, insertSpaces: indent !== 'tab' }
}

function createOptions(indent: IndentOption): Monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    automaticLayout: true,
    minimap: { enabled: false },
    fontFamily: "'JetBrains Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace",
    fontSize: 13,
    lineHeight: 21,
    detectIndentation: false,
    ...indentOptions(indent),
    folding: true,
    foldingHighlight: true,
    showFoldingControls: 'always',
    unfoldOnClickAfterEndOfLine: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: 'active', indentation: true, highlightActiveIndentation: true },
    renderLineHighlight: 'all',
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    padding: { top: 14, bottom: 14 },
    wordWrap: 'off',
    stickyScroll: { enabled: true, maxLineCount: 4 },
    quickSuggestions: { other: true, comments: false, strings: true },
    suggestOnTriggerCharacters: true,
    tabCompletion: 'on',
    suggest: { showWords: false, preview: true, snippetsPreventQuickSuggestions: false },
    formatOnPaste: true,
    autoIndent: 'full',
    unicodeHighlight: { ambiguousCharacters: false },
    links: false,
    colorDecorators: true,
    occurrencesHighlight: 'singleFile',
    selectionHighlight: true,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      useShadows: false,
      alwaysConsumeMouseWheel: false,
    },
    fixedOverflowWidgets: true,
    // Monaco 0.57 renders context views (e.g. the right-click menu) inside a shadow root by
    // default. The theme's --vscode-* variables are scoped to `.monaco-editor`/`.monaco-component`
    // and do not cross that boundary, which leaves the menu transparent and unstyled. Rendering
    // widgets in the light DOM keeps them themed.
    useShadowDOM: false,
  }
}

/** Replaces the whole document through the undo stack, keeping the caret roughly in place. */
function applyDocument(next: string): void {
  if (!editor || !model) return
  const position = editor.getPosition()
  model.pushEditOperations([], [{ range: model.getFullModelRange(), text: next }], () => null)
  const line = Math.min(position?.lineNumber ?? 1, model.getLineCount())
  editor.setPosition({
    lineNumber: line,
    column: Math.min(position?.column ?? 1, model.getLineMaxColumn(line)),
  })
}

function toMarker(
  issue: JsonIssue,
  monacoApi: MonacoApi,
  target: Monaco.editor.ITextModel,
): Monaco.editor.IMarkerData {
  const start = target.getPositionAt(issue.offset)
  const end = target.getPositionAt(
    Math.min(issue.offset + Math.max(issue.length, 1), target.getValueLength()),
  )
  return {
    severity: monacoApi.MarkerSeverity.Error,
    message: issue.message,
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  }
}

function toWarningMarker(
  warning: SchemaWarning,
  monacoApi: MonacoApi,
  target: Monaco.editor.ITextModel,
): Monaco.editor.IMarkerData {
  const start = target.getPositionAt(warning.offset)
  const end = target.getPositionAt(
    Math.min(warning.offset + Math.max(warning.length, 1), target.getValueLength()),
  )
  return {
    severity: monacoApi.MarkerSeverity.Warning,
    message: warning.message,
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  }
}

function runAction(id: string): void {
  void editor?.getAction(id)?.run()
}

onMounted(async () => {
  const [monacoApi, setup] = await Promise.all([import('monaco-editor'), import('@/monaco/setup')])
  if (!host.value) return

  setup.setupMonaco()
  const createdModel = monacoApi.editor.createModel(
    store.text,
    'json',
    monacoApi.Uri.parse(DOCUMENT_URI),
  )
  // Monaco defaults to the platform line ending; pin it so edits, formatting and downloads agree.
  createdModel.setEOL(monacoApi.editor.EndOfLineSequence.LF)
  const createdEditor = monacoApi.editor.create(host.value, {
    model: createdModel,
    theme: MONACO_THEME[store.theme],
    ...createOptions(store.indent),
  })
  model = createdModel
  editor = createdEditor

  disposables.push(
    createdEditor.onDidChangeModelContent(() => {
      store.setText(createdModel.getValue())
    }),
    createdEditor.onDidChangeCursorPosition((event) => {
      store.setCursor({ line: event.position.lineNumber, column: event.position.column })
    }),
    createdEditor.onDidChangeCursorSelection((event) => {
      store.setSelectionLength(createdModel.getValueLengthInRange(event.selection))
    }),
  )

  createdEditor.addCommand(
    monacoApi.KeyMod.CtrlCmd | monacoApi.KeyMod.Shift | monacoApi.KeyCode.KeyF,
    () => store.format(),
  )
  createdEditor.addCommand(
    monacoApi.KeyMod.CtrlCmd | monacoApi.KeyMod.Shift | monacoApi.KeyCode.KeyM,
    () => store.minify(),
  )

  stopHandles.push(
    watch(
      () => store.text,
      (next) => {
        if (createdModel.getValue() !== next) applyDocument(next)
      },
    ),
    watch(
      () => store.reveal,
      (target) => {
        if (!target) return
        const selection = new monacoApi.Selection(
          target.start.line,
          target.start.column,
          target.end.line,
          target.end.column,
        )
        createdEditor.setSelection(selection)
        createdEditor.revealRangeInCenterIfOutsideViewport(
          selection,
          monacoApi.editor.ScrollType.Smooth,
        )
        createdEditor.focus()
      },
    ),
    watch(
      () => store.theme,
      (mode) => {
        monacoApi.editor.setTheme(MONACO_THEME[mode])
      },
    ),
    watch(
      () => store.indent,
      (indent) => {
        createdModel.updateOptions(indentOptions(indent))
      },
    ),
    watch(
      [() => store.issues, () => schemaStore.warnings],
      ([issues, warnings]) => {
        monacoApi.editor.setModelMarkers(createdModel, MARKER_OWNER, [
          ...issues.map((issue) => toMarker(issue, monacoApi, createdModel)),
          ...warnings.map((warning) => toWarningMarker(warning, monacoApi, createdModel)),
        ])
      },
      { immediate: true },
    ),
    watch(
      () => schemaStore.schemas,
      (schemas) => {
        // Register inline schemas so completion and hover work without Monaco fetching anything.
        // `$schema` in the document resolves against these by URI.
        monacoApi.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: false,
          enableSchemaRequest: false,
          schemas: schemas.map(({ url, schema }) => ({ uri: url, schema })),
        })
      },
      { immediate: true },
    ),
  )

  ready.value = true
})

onBeforeUnmount(() => {
  for (const stop of stopHandles) stop()
  for (const disposable of disposables) disposable.dispose()
  editor?.dispose()
  model?.dispose()
  editor = null
  model = null
})

defineExpose({
  foldAll: () => runAction('editor.foldAll'),
  unfoldAll: () => runAction('editor.unfoldAll'),
  foldLevel: (level: number) => runAction(`editor.foldLevel${level}`),
  focus: () => editor?.focus(),
})
</script>

<template>
  <div class="editor-shell">
    <div ref="host" class="editor-host"></div>
    <div v-if="!ready" class="editor-overlay">
      <span class="editor-overlay-text">正在加载编辑器…</span>
    </div>
    <div v-else-if="store.analysis.status === 'empty'" class="editor-overlay">
      <span class="editor-overlay-text">粘贴或输入 JSON 内容</span>
      <button type="button" class="ghost-button" @click="store.loadSample('valid')">
        载入示例
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-shell {
  position: relative;
  height: 100%;
  min-height: 0;
  background: var(--editor-background);
}

.editor-host {
  height: 100%;
}

.editor-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  pointer-events: none;
  color: var(--text-muted);
  font-size: 13px;
}

.editor-overlay .ghost-button {
  pointer-events: auto;
}
</style>
