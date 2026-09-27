<script setup lang="ts">
import { computed } from 'vue'
import { useJsonDocumentStore } from '@/stores/jsonDocument'
import { createPositionResolver, type JsonIssue } from '@/utils/json'

const store = useJsonDocumentStore()

const issues = computed(() => store.issues)

function reveal(issue: JsonIssue): void {
  const resolve = createPositionResolver(store.text)
  const end = resolve(issue.offset + Math.max(issue.length, 1))
  store.requestReveal({ line: issue.line, column: issue.column }, end)
}
</script>

<template>
  <div class="problems-panel">
    <div v-if="issues.length === 0" class="panel-empty">
      <p>未发现问题</p>
      <p class="panel-hint">符合 JSON 标准：不支持注释与尾随逗号</p>
    </div>
    <ul v-else class="problem-list">
      <li
        v-for="(issue, index) in issues"
        :key="`${issue.offset}:${index}`"
        class="problem-item"
        @click="reveal(issue)"
      >
        <span class="problem-dot"></span>
        <div class="problem-body">
          <p class="problem-message">{{ issue.message }}</p>
          <p class="problem-location">行 {{ issue.line }}，列 {{ issue.column }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.problems-panel {
  height: 100%;
  overflow: auto;
}

.problem-list {
  margin: 0;
  padding: 6px 0 12px;
  list-style: none;
}

.problem-item {
  display: flex;
  gap: 8px;
  padding: 7px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-soft);
}

.problem-item:hover {
  background: var(--surface-hover);
}

.problem-dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--danger);
}

.problem-body {
  min-width: 0;
}

.problem-message {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text);
  overflow-wrap: anywhere;
}

.problem-location {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
}
</style>
