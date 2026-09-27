import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import JsonWorker from 'monaco-editor/languages/features/json/json.worker.js?worker'
import { registerJsonCompletion } from './completion'
import { MONACO_THEMES, MONACO_THEME, type ThemeMode } from './theme'

let initialized = false

/** Registers web workers, themes and language providers. Safe to call more than once. */
export function setupMonaco(): void {
  if (initialized) return
  initialized = true

  globalThis.MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      return label === 'json' ? new JsonWorker() : new EditorWorker()
    },
  }

  for (const mode of Object.keys(MONACO_THEMES) as ThemeMode[]) {
    const definition = MONACO_THEMES[mode]
    monaco.editor.defineTheme(MONACO_THEME[mode], {
      base: definition.base,
      inherit: true,
      rules: definition.rules,
      colors: definition.colors,
    })
  }

  monaco.json.jsonDefaults.setModeConfiguration({
    documentFormattingEdits: true,
    documentRangeFormattingEdits: true,
    completionItems: true,
    hovers: true,
    documentSymbols: true,
    tokens: true,
    colors: true,
    foldingRanges: true,
    // Syntax diagnostics come from jsonc-parser instead, so the squiggles and the problem
    // list share one source and can be localized.
    diagnostics: false,
    selectionRanges: true,
  })

  registerJsonCompletion()
}
