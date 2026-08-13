<script setup lang="ts">
import { computed } from "vue";
import type { RecallItem, ScoreBreakdown } from "@/api/types";

const props = defineProps<{ item: RecallItem; utilityNote?: string | null }>();

const rows = computed(() => {
  const labels: Array<[keyof ScoreBreakdown, string]> = [
    ["semantic", "相关性"],
    ["lexical", "词法"],
    ["vector", "向量"],
    ["context", "上下文"],
    ["belief", "信念"],
    ["utility", "效用"],
    ["recency", "时效"],
  ];
  return labels
    .map(([key, label]) => ({ key, label, value: props.item.breakdown[key] }))
    .filter((row) => row.value !== null)
    .map((row) => ({ key: row.key, label: row.label, value: row.value as number }));
});
</script>

<template>
  <aside class="score-box">
    <div class="score-total">
      <span>综合得分</span>
      <b>{{ item.score.toFixed(3) }}</b>
    </div>
    <div v-for="row in rows" :key="row.key" class="score-row">
      <span>{{ row.label }}</span>
      <span class="score-track">
        <i :style="{ width: `${Math.max(0, Math.min(100, row.value * 100))}%` }" />
      </span>
      <b class="num">{{ row.value.toFixed(2) }}</b>
    </div>
    <p v-if="utilityNote" class="utility-note">{{ utilityNote }}</p>
  </aside>
</template>
