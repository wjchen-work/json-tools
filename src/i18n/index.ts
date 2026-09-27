import { createI18n } from 'vue-i18n'
import enUS from '@/i18n/messages/en-US'
import zhCN from '@/i18n/messages/zh-CN'

/** 以中文消息为基准，为 `t()` / `$t()` 提供 key 补全与类型校验。 */
export type MessageSchema = typeof zhCN

declare module 'vue-i18n' {
  // 声明合并必须用 interface；空 body 是该模式的固有形态。
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

const DEFAULT_LOCALE: AppLocale = 'zh-CN'
const STORAGE_KEY = 'json-tools:locale'

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** 匹配浏览器偏好语言，例如 `zh-Hans-CN` 归到 `zh-CN`；匹配不到时用中文兜底。 */
function detectLocale(): AppLocale {
  const preferred = navigator.languages.length > 0 ? navigator.languages : [navigator.language]
  for (const language of preferred) {
    const normalized = language.toLowerCase()
    if (normalized.startsWith('zh')) return 'zh-CN'
    if (normalized.startsWith('en')) return 'en-US'
  }
  return DEFAULT_LOCALE
}

/** 手动选择优先于浏览器语言；读取失败时退回检测结果。 */
function loadLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isAppLocale(stored)) return stored
  } catch {
    // 存储不可用不应影响启动，忽略后走浏览器语言检测。
  }
  return detectLocale()
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: loadLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
})

/**
 * 组件 setup 之外（Pinia store、utils、Monaco provider）的翻译入口。
 * `i18n.global.t` 基于闭包实现，可安全脱离实例调用，并随 locale 变化保持响应式。
 */
export const t = i18n.global.t

export function currentLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale
}

export function setLocale(next: AppLocale): void {
  if (!isAppLocale(next) || next === currentLocale()) return
  i18n.global.locale.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // 记住偏好是尽力而为，写入失败不影响本次切换。
  }
  syncDocumentLocale()
}

/** 把当前语言同步到 `<html lang>` 与文档标题。 */
function syncDocumentLocale(): void {
  document.documentElement.lang = currentLocale()
  document.title = t('app.title')
}

syncDocumentLocale()
