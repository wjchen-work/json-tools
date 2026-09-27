import type { MessageSchema } from '@/i18n'

const enUS: MessageSchema = {
  app: {
    title: 'JSON Tools',
    tagline: 'Format · Minify · Validate · Navigate',
    theme: {
      switchToDark: 'Switch to dark theme',
      switchToLight: 'Switch to light theme',
      dark: 'Dark',
      light: 'Light',
    },
    locale: {
      label: 'Language',
      switchTo: 'Switch language',
      zhCN: '中文',
      enUS: 'English',
    },
  },

  toolbar: {
    format: 'Format',
    formatTitle: 'Format (Ctrl+Shift+F)',
    minify: 'Minify',
    minifyTitle: 'Minify to a single line (Ctrl+Shift+M)',
    foldAll: 'Fold all',
    unfoldAll: 'Unfold all',
    foldLevelTitle: 'Fold to a specific level',
    foldLevelPlaceholder: 'Fold to level…',
    foldLevel: 'Level {level}',
    indentTitle: 'Indentation',
    indent2: 'Indent: 2 spaces',
    indent4: 'Indent: 4 spaces',
    indentTab: 'Indent: Tab',
    schemaMapping: '$schema mapping',
    schemaMappingTitle: 'Manage $schema content mappings',
    copy: 'Copy',
    download: 'Download',
    import: 'Import',
    sample: 'Sample',
    sampleBroken: 'Broken sample',
    clear: 'Clear',
  },

  tabs: {
    tree: 'Structure',
    problems: 'Problems',
  },

  tree: {
    rowCount: '{count} line | {count} lines',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    expand: 'Expand',
    collapse: 'Collapse',
    syntaxError: 'The document has syntax errors',
    issueHint:
      '{count} issue — see the Problems tab for its location | {count} issues — see the Problems tab for their locations',
    empty: 'Nothing here yet',
    emptyHint: 'Paste JSON to generate the structure tree',
    copyPath: 'Copy JSON path',
    copyKey: 'Copy key',
    copyValue: 'Copy value',
    openList: 'Open list view',
    objectSummary: '{count} field | {count} fields',
    arraySummary: '{count} item | {count} items',
  },

  problems: {
    none: 'No problems found',
    noneHint: 'Valid JSON: comments and trailing commas are not supported',
    location: 'Line {line}, Col {column}',
  },

  list: {
    title: 'List view',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    closePanel: 'Close panel',
    close: 'Close',
    unparsable: 'The document cannot be parsed, so this array cannot be shown',
    notFound: 'No matching array found, or the array is empty',
  },

  schema: {
    panelTitle: '$schema content mappings',
    panelHint: 'When automatic fetching fails, paste the content here to map it to a URL',
    close: 'Close',
    searchPlaceholder: 'Search or enter a URL',
    add: 'Add',
    currentDocument: 'Current document',
    valid: 'Valid',
    noMatch: 'No matching mappings',
    addNamed: 'Add “{url}”',
    empty: 'No mappings yet. Enter a URL and click "Add"',
    editUrl: 'Edit URL',
    noSelection: 'No mapping selected',
    fetch: 'Fetch',
    remove: 'Delete',
    editorLoading: 'Loading editor…',
    editorHint: 'Enter a URL in the search box and click "Add" to paste schema content here',
  },

  editor: {
    loading: 'Loading editor…',
    placeholder: 'Paste or type JSON',
    loadSample: 'Load sample',
  },

  status: {
    empty: 'Empty document',
    errorCount: '{count} error | {count} errors',
    valid: 'Valid JSON',
    cursor: 'Line {line}, Col {column}',
    selectedChars: '{count} character selected | {count} characters selected',
    lines: '{count} line | {count} lines',
    characters: '{count} character | {count} characters',
    values: '{count} value | {count} values',
    depth: 'Depth {depth}',
  },
}

export default enUS
