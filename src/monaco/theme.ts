export type ThemeMode = 'light' | 'dark'

export const MONACO_THEME: Record<ThemeMode, string> = {
  light: 'json-tools-light',
  dark: 'json-tools-dark',
}

export interface MonacoThemeDefinition {
  base: 'vs' | 'vs-dark'
  rules: { token: string; foreground: string; fontStyle?: string }[]
  colors: Record<string, string>
}

const BRACKET_COLORS: Record<ThemeMode, string[]> = {
  light: ['#268bd2', '#859900', '#b58900', '#d33682', '#6c71c4', '#2aa198'],
  // Darcula keeps brackets close to the foreground so the orange/green syntax colors stay dominant.
  dark: ['#a9b7c6', '#6a8759', '#6897bb', '#cc7832', '#9876aa', '#bbb529'],
}

function bracketColors(mode: ThemeMode): Record<string, string> {
  const colors: Record<string, string> = {}
  BRACKET_COLORS[mode].forEach((color, index) => {
    colors[`editorBracketHighlight.foreground${index + 1}`] = color
  })
  return colors
}

export const MONACO_THEMES: Record<ThemeMode, MonacoThemeDefinition> = {
  light: {
    base: 'vs',
    rules: [
      { token: 'string.key.json', foreground: '268bd2' },
      { token: 'string.value.json', foreground: '2aa198' },
      { token: 'number', foreground: 'd33682' },
      { token: 'keyword.json', foreground: '859900' },
      { token: 'delimiter.bracket.json', foreground: '657b83' },
      { token: 'delimiter.array.json', foreground: '657b83' },
      { token: 'delimiter.comma.json', foreground: '93a1a1' },
      { token: 'delimiter.colon.json', foreground: '93a1a1' },
    ],
    colors: {
      'editor.background': '#fdf6e3',
      'editor.foreground': '#657b83',
      'editorGutter.background': '#fdf6e3',
      'editorLineNumber.foreground': '#93a1a1',
      'editorLineNumber.activeForeground': '#586e75',
      'editor.lineHighlightBackground': '#eee8d5',
      'editor.selectionBackground': '#b5d7ee',
      'editor.inactiveSelectionBackground': '#dbe9f4',
      // Monaco's `.focused .selectionHighlight` rule wins over its own 50%-alpha rule, so the
      // value here is applied as-is. Keep the fill transparent and mark occurrences with a border
      // instead: filled = selected text, outlined = occurrence.
      'editor.selectionHighlightBackground': '#00000000',
      'editor.selectionHighlightBorder': '#268bd2',
      'editor.wordHighlightBackground': '#00000000',
      'editor.wordHighlightBorder': '#657b83',
      'editor.wordHighlightStrongBackground': '#00000000',
      'editor.wordHighlightStrongBorder': '#859900',
      'editor.wordHighlightTextBackground': '#00000000',
      'editor.wordHighlightTextBorder': '#657b83',
      'editorIndentGuide.background1': '#e4decc',
      'editorIndentGuide.activeBackground1': '#93a1a1',
      'editorStickyScroll.background': '#eee8d5',
      'editorStickyScrollHover.background': '#e4decc',
      'editorWidget.background': '#fdf6e3',
      'editorWidget.border': '#d6d0bf',
      'editorSuggestWidget.selectedBackground': '#d7e7f2',
      'editorSuggestWidget.highlightForeground': '#268bd2',
      'editorHoverWidget.background': '#fdf6e3',
      'editorHoverWidget.border': '#d6d0bf',
      'editorError.foreground': '#dc322f',
      'editorWarning.foreground': '#b58900',
      'editorInfo.foreground': '#268bd2',
      ...bracketColors('light'),
    },
  },
  dark: {
    base: 'vs-dark',
    rules: [
      { token: 'string.key.json', foreground: '9876aa' },
      { token: 'string.value.json', foreground: '6a8759' },
      { token: 'number', foreground: '6897bb' },
      { token: 'keyword.json', foreground: 'cc7832' },
      { token: 'delimiter.bracket.json', foreground: 'a9b7c6' },
      { token: 'delimiter.array.json', foreground: 'a9b7c6' },
      { token: 'delimiter.comma.json', foreground: '808080' },
      { token: 'delimiter.colon.json', foreground: '808080' },
    ],
    colors: {
      'editor.background': '#2b2b2b',
      'editor.foreground': '#a9b7c6',
      'editorGutter.background': '#2b2b2b',
      'editorLineNumber.foreground': '#606366',
      'editorLineNumber.activeForeground': '#a9b7c6',
      'editor.lineHighlightBackground': '#323232',
      'editor.selectionBackground': '#214283',
      'editor.inactiveSelectionBackground': '#2d435e',
      // Monaco's `.focused .selectionHighlight` rule wins over its own 50%-alpha rule, so the
      // value here is applied as-is. Keep the fill transparent and mark occurrences with a border
      // instead: filled = selected text, outlined = occurrence.
      'editor.selectionHighlightBackground': '#00000000',
      'editor.selectionHighlightBorder': '#4c8bf5',
      'editor.wordHighlightBackground': '#00000000',
      'editor.wordHighlightBorder': '#a9b7c6',
      'editor.wordHighlightStrongBackground': '#00000000',
      'editor.wordHighlightStrongBorder': '#6a8759',
      'editor.wordHighlightTextBackground': '#00000000',
      'editor.wordHighlightTextBorder': '#a9b7c6',
      'editorIndentGuide.background1': '#323232',
      'editorIndentGuide.activeBackground1': '#4b6eaf',
      'editorStickyScroll.background': '#313335',
      'editorStickyScrollHover.background': '#3c3f41',
      'editorWidget.background': '#3c3f41',
      'editorWidget.border': '#555555',
      'editorSuggestWidget.selectedBackground': '#214283',
      'editorSuggestWidget.highlightForeground': '#6ea8fe',
      'editorHoverWidget.background': '#3c3f41',
      'editorHoverWidget.border': '#555555',
      'editorError.foreground': '#ff6b68',
      'editorWarning.foreground': '#bbb529',
      'editorInfo.foreground': '#6897bb',
      ...bracketColors('dark'),
    },
  },
}
