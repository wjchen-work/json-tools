# json-tools

基于 [Monaco Editor](https://microsoft.github.io/monaco-editor/) 的 JSON 工具，Vue 3 + TypeScript + Vite。

## 功能

- **高亮**：JSON 语法着色、括号配对与缩进参考线，内置浅色/深色主题
- **格式化 / 压缩**：格式化保留键顺序与数字字面量写法（`1.0`、`1e3`、超长整数不被改写），支持 2 空格、4 空格、Tab 缩进；压缩为单行
- **错误提示**：编辑器内波浪线 + 「问题」面板列出全部语法错误，点击可跳转到出错位置
- **补全**：输入 `"` 或 `Ctrl+Space` 触发，优先提示文档中已出现的字段，其次为常用字段；值位置提供 `null`/`true`/`false` 与对象、数组、字符串片段
- **收缩与展开节点**：行号槽折叠控件、工具栏「折叠全部 / 展开全部 / 折叠到第 N 层」，以及「结构」面板中的可展开结构树，点击节点可在编辑器中选中并定位

其他：复制、下载 `data.json`、导入本地文件、清空、示例与含错误示例、状态栏统计（行列、行数、字符数、大小、值数量、深度）。

快捷键：`Ctrl/Cmd+Shift+F` 格式化，`Ctrl/Cmd+Shift+M` 压缩。

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```
