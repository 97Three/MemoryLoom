<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Collection, Refresh } from "@element-plus/icons-vue";

import CorrectionDialog, { type CorrectionTarget } from "@/components/CorrectionDialog.vue";
import EmptyState from "@/components/EmptyState.vue";
import HistoryDialog from "@/components/HistoryDialog.vue";
import PageHeader from "@/components/PageHeader.vue";
import type { PreferenceSummary } from "@/api/types";
import { formatDate } from "@/utils/format";
import { useConsole } from "@/stores/console";

const store = useConsole();
const router = useRouter();

const historyOpen = ref(false);
const historyRecord = ref<string | null>(null);
const correctionOpen = ref(false);
const correctionTarget = ref<CorrectionTarget | null>(null);
const seeding = ref(false);

async function loadDemo(): Promise<void> {
  seeding.value = true;
  try {
    const result = await store.seedDemo();
    if (result.failed > 0) {
      ElMessage.error(`写入失败 ${result.failed} 条：${result.firstError ?? "未知错误"}`);
      return;
    }
    ElMessage.success(
      result.created > 0 ? `已载入 ${result.created} 条演示记忆` : "演示数据已存在，没有重复写入",
    );
  } finally {
    seeding.value = false;
  }
}

function openHistory(recordId: string): void {
  historyRecord.value = recordId;
  historyOpen.value = true;
}

function openCorrection(item: PreferenceSummary): void {
  correctionTarget.value = {
    record_id: item.record_id,
    revision_id: item.revision_id,
    key: item.key,
    value: item.value,
  };
  correctionOpen.value = true;
}

onMounted(async () => {
  await store.loadMemories();
  // Marking the step on an empty scope would claim progress that no memory backs.
  if (store.memories.length > 0) store.markJourney("view");
});
</script>

<template>
  <PageHeader
    eyebrow="ACTIVE BELIEFS"
    title="当前记忆"
    sub="这里只显示此刻有效的版本。刷新是只读操作，不会让它更自信；想改就追加一条新版本，旧结论始终留在历史里。"
  >
    <template #icon>
      <el-icon :size="20"><Collection /></el-icon>
    </template>
    <template #actions>
      <el-button :icon="Refresh" :loading="store.loadingMemories" @click="store.loadMemories()">
        刷新列表
      </el-button>
      <el-button type="primary" @click="router.push({ name: 'capture' })">写入记忆</el-button>
    </template>
  </PageHeader>

  <article class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">{{ store.memories.length }} 条记忆</h2>
        <p class="card-sub">作用域 {{ store.scopeLabel }} · 每条偏好一个活动修订</p>
      </div>
      <div class="chips">
        <span class="chip">读不改变信念</span>
      </div>
    </div>

    <el-table v-if="store.memories.length" :data="store.memories" style="width: 100%" row-key="record_id">
      <el-table-column label="记忆键" min-width="150">
        <template #default="{ row }">
          <span class="mono">{{ row.key }}</span>
        </template>
      </el-table-column>

      <el-table-column label="当前值" min-width="170">
        <template #default="{ row }">
          <span class="value">{{ row.value }}</span>
        </template>
      </el-table-column>

      <el-table-column label="上下文" min-width="160">
        <template #default="{ row }">
          <div class="chips">
            <span v-if="!Object.keys(row.context).length" class="chip">通用上下文</span>
            <span v-for="(value, key) in row.context" :key="key" class="chip">
              {{ key }}: <b>{{ value }}</b>
            </span>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="置信度" width="130">
        <template #default="{ row }">
          <el-progress
            :percentage="Math.round(row.confidence * 100)"
            :stroke-width="6"
            :show-text="false"
          />
          <span class="hint">{{ row.confidence.toFixed(2) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="证据" width="70" align="right">
        <template #default="{ row }">
          <span class="num">{{ row.evidence_count }}</span>
        </template>
      </el-table-column>

      <el-table-column label="修订" width="90">
        <template #default="{ row }">
          <span class="chip">#{{ row.sequence }}</span>
        </template>
      </el-table-column>

      <el-table-column label="更新" width="110">
        <template #default="{ row }">
          <span class="hint">{{ formatDate(row.recorded_at) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="" width="140" align="right">
        <template #default="{ row }">
          <el-button size="small" text @click="openHistory(row.record_id)">历史</el-button>
          <el-button size="small" text @click="openCorrection(row as PreferenceSummary)">
            修正
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <EmptyState
      v-else-if="!store.loadingMemories"
      title="当前作用域还没有记忆"
      copy="可以先载入一组演示数据看看完整效果，也可以自己写一条带原话的偏好。"
    >
      <template #icon><el-icon :size="22"><Collection /></el-icon></template>
      <template #action>
        <div class="empty-actions">
          <el-button type="primary" :loading="seeding" @click="loadDemo">载入演示数据</el-button>
          <el-button @click="router.push({ name: 'capture', query: { example: '1' } })">
            自己写一条
          </el-button>
        </div>
      </template>
    </EmptyState>

    <div v-else class="loading-state">正在读取当前记忆…</div>
  </article>

  <HistoryDialog v-model="historyOpen" :record-id="historyRecord" />
  <CorrectionDialog
    v-model="correctionOpen"
    :target="correctionTarget"
    @saved="() => store.loadMemories(true)"
  />
</template>

<style scoped>
.empty-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.value {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.2px;
}

.loading-state {
  padding: 40px 0;
  text-align: center;
  color: var(--ink3);
  font-size: 12.5px;
}
</style>
