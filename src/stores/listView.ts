import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export interface ListViewTab {
  /** Stable identity, independent of the JSON path. */
  id: string
  /** JSON path of the array node this tab renders. */
  path: string
  /** Tab label, defaults to the JSON path and can be renamed by double click. */
  title: string
}

/**
 * Bottom "列表查看" drawer: one tab per array the user opened. Tabs are the only
 * way to close the drawer, so it stays open until every tab is dismissed.
 */
export const useListViewStore = defineStore('listView', () => {
  const tabs = ref<ListViewTab[]>([])
  const activeId = ref<string | null>(null)

  let counter = 0

  const open = computed(() => tabs.value.length > 0)
  const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeId.value) ?? null)

  /** Reuses the tab when the same array is opened twice, otherwise appends a new one. */
  function openTab(path: string): void {
    const existing = tabs.value.find((tab) => tab.path === path)
    if (existing) {
      activeId.value = existing.id
      return
    }
    counter += 1
    const tab: ListViewTab = { id: `list-${counter}`, path, title: path }
    tabs.value.push(tab)
    activeId.value = tab.id
  }

  function activate(id: string): void {
    if (tabs.value.some((tab) => tab.id === id)) activeId.value = id
  }

  function closeTab(id: string): void {
    const index = tabs.value.findIndex((tab) => tab.id === id)
    if (index === -1) return
    tabs.value.splice(index, 1)
    if (activeId.value !== id) return
    const next = tabs.value[index] ?? tabs.value[index - 1] ?? null
    activeId.value = next?.id ?? null
  }

  /** Dismisses every tab at once, closing the drawer. */
  function closeAll(): void {
    tabs.value = []
    activeId.value = null
  }

  function renameTab(id: string, title: string): void {
    const tab = tabs.value.find((item) => item.id === id)
    if (!tab) return
    const trimmed = title.trim()
    tab.title = trimmed.length > 0 ? trimmed : tab.path
  }

  return { tabs, activeId, open, activeTab, openTab, activate, closeTab, closeAll, renameTab }
})
