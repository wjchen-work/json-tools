/**
 * 源语言。`MessageSchema` 以本文件为基准，`en-US.ts` 必须与之对齐，
 * 缺 key / 多 key 都会在 `pnpm type-check` 阶段报错。
 *
 * 复数：中文只写单形式（不含 `|`），英文用 `{count} x | {count} xs`，
 * 调用时以数字作为第二参数（`t(key, n)`）触发复数选择。
 */
export default {
  app: {
    title: 'JSON 工具',
    tagline: '格式化 · 压缩 · 校验 · 结构导航',
    theme: {
      switchToDark: '切换到深色主题',
      switchToLight: '切换到浅色主题',
      dark: '深色',
      light: '浅色',
    },
    locale: {
      label: '语言',
      switchTo: '切换语言',
      zhCN: '中文',
      enUS: 'English',
    },
  },

  toolbar: {
    format: '格式化',
    formatTitle: '格式化（Ctrl+Shift+F）',
    minify: '压缩',
    minifyTitle: '压缩为单行（Ctrl+Shift+M）',
    foldAll: '折叠全部',
    unfoldAll: '展开全部',
    foldLevelTitle: '折叠到指定层级',
    foldLevelPlaceholder: '折叠到层级…',
    foldLevel: '第 {level} 层',
    indentTitle: '缩进方式',
    indent2: '缩进：2 空格',
    indent4: '缩进：4 空格',
    indentTab: '缩进：Tab',
    schemaMapping: '$schema 映射',
    schemaMappingTitle: '$schema 内容映射管理',
    copy: '复制',
    download: '下载',
    import: '导入',
    sample: '示例',
    sampleBroken: '错误示例',
    clear: '清空',
  },

  tabs: {
    tree: '结构',
    problems: '问题',
  },

  tree: {
    rowCount: '{count} 行',
    expandAll: '展开全部',
    collapseAll: '折叠全部',
    expand: '展开',
    collapse: '折叠',
    syntaxError: '文档存在语法错误',
    issueHint: '共 {count} 处问题，可在「问题」标签页查看具体位置',
    empty: '暂无内容',
    emptyHint: '粘贴 JSON 后会自动生成结构树',
    copyPath: '复制 JSON 路径',
    copyKey: '复制 Key',
    copyValue: '复制值',
    openList: '列表查看',
    objectSummary: '{count} 个字段',
    arraySummary: '{count} 项',
  },

  problems: {
    none: '未发现问题',
    noneHint: '符合 JSON 标准：不支持注释与尾随逗号',
    location: '行 {line}，列 {column}',
  },

  list: {
    title: '列表查看',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    closePanel: '关闭面板',
    close: '关闭',
    unparsable: '文档无法解析，暂时无法展示该数组',
    notFound: '未找到对应的数组，或数组为空',
  },

  schema: {
    panelTitle: '$schema 内容映射',
    panelHint: '自动拉取失败时，可在此手动粘贴内容，与 URL 一一对应',
    close: '关闭',
    searchPlaceholder: '搜索或输入 URL',
    add: '新增',
    currentDocument: '当前文档',
    valid: '有效',
    noMatch: '没有匹配的映射',
    addNamed: '新增 “{url}”',
    empty: '暂无映射，输入 URL 后点击「新增」',
    editUrl: '编辑 URL',
    noSelection: '未选择映射',
    fetch: '拉取',
    remove: '删除',
    editorLoading: '正在加载编辑器…',
    editorHint: '在检索框输入 URL 并点击「新增」，即可在此粘贴 schema 内容',
  },

  editor: {
    loading: '正在加载编辑器…',
    placeholder: '粘贴或输入 JSON 内容',
    loadSample: '载入示例',
  },

  status: {
    empty: '空文档',
    errorCount: '{count} 个错误',
    valid: 'JSON 有效',
    cursor: '行 {line}，列 {column}',
    selectedChars: '已选 {count} 字符',
    lines: '{count} 行',
    characters: '{count} 字符',
    values: '{count} 个值',
    depth: '深度 {depth}',
  },
}
