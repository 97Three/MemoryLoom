<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { memoryApi } from "@/api/memory";
import { describeError, isCancelled } from "@/api/client";
import { formatFullDate, shortId } from "@/utils/format";
import type { Revision } from "@/api/types";
import { useConsole, ScopeChangedError } from "@/stores/console";

const props = defineProps<{ modelValue: boolean; recordId: string | null }>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const store = useConsole();
const revisions = ref<Revision[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

watch(
  () => [props.modelValue, props.recordId] as const,
  async ([open, recordId]) => {
    if (!open || !recordId) return;
    loading.value = true;
    error.value = null;
    revisions.value = [];
    try {
      revisions.value = await store.scoped("history", (signal) =>
        memoryApi.revisions(recordId, store.scope, signal),
      );
    } catch (caught) {
      if (isCancelled(caught) || caught instanceof ScopeChangedError) return;
      error.value = describeError(caught);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <el-dialog v-model="visible" title="不可变修订历史" width="620px" align-center>
    <p class="hint">
      修正不会覆盖旧版本，而是追加新的修订并保留完整版本链。历史是只读的。
    </p>
    <div v-if="loading" class="history-state">正在读取修订链…</div>
    <div v-else-if="error" class="history-state">{{ error }}</div>
    <div v-else-if="!revisions.length" class="history-state">这条记忆还没有可读取的修订。</div>
    <ol v-else class="revision-list">
      <li v-for="revision in revisions" :key="revision.id" class="revision">
        <span class="revision-seq">#{{ revision.sequence }}</span>
        <div>
          <p class="revision-value">{{ revision.value }}</p>
          <p class="revision-meta">
            记录于 {{ formatFullDate(revision.recorded_at) }} ·
            revision {{ shortId(revision.id) }}
          </p>
          <div class="chips">
            <span class="chip">置信度 <b>{{ revision.confidence.toFixed(2) }}</b></span>
            <span class="chip">支持证据 <b>{{ revision.support_count }}</b></span>
            <span class="chip">{{ revision.supersedes_revision_id ? "替代上一版本" : "初始版本" }}</span>
          </div>
        </div>
      </li>
    </ol>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.history-state {
  padding: 26px 0;
  text-align: center;
  color: var(--ink3);
  font-size: 12.5px;
}

.revision-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.revision {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--line2);
}

.revision:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.revision-seq {
  width: 38px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: var(--r-sm);
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 11.5px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.revision-value {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.revision-meta {
  margin: 3px 0 7px;
  font-size: 11.5px;
  color: var(--ink4);
}
</style>
