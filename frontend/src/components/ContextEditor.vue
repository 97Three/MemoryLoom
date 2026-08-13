<script setup lang="ts">
import { Delete, Plus } from "@element-plus/icons-vue";

export interface Facet {
  key: string;
  value: string;
}

const props = defineProps<{ modelValue: Facet[] }>();
const emit = defineEmits<{ "update:modelValue": [Facet[]] }>();

function patch(index: number, changes: Partial<Facet>): void {
  emit(
    "update:modelValue",
    props.modelValue.map((facet, position) =>
      position === index ? { ...facet, ...changes } : facet,
    ),
  );
}

function add(): void {
  emit("update:modelValue", [...props.modelValue, { key: "", value: "" }]);
}

function remove(index: number): void {
  emit(
    "update:modelValue",
    props.modelValue.filter((_, position) => position !== index),
  );
}
</script>

<template>
  <div class="context-list">
    <div v-for="(facet, index) in modelValue" :key="index" class="context-row">
      <el-input
        :model-value="facet.key"
        placeholder="上下文键，如 time_of_day"
        aria-label="上下文键"
        @update:model-value="(value: string) => patch(index, { key: value })"
      />
      <span class="context-eq">=</span>
      <el-input
        :model-value="facet.value"
        placeholder="值，如 evening"
        aria-label="上下文值"
        @update:model-value="(value: string) => patch(index, { value })"
      />
      <el-button
        text
        :icon="Delete"
        aria-label="移除上下文"
        :disabled="modelValue.length <= 1"
        @click="remove(index)"
      />
    </div>
    <div>
      <el-button size="small" text :icon="Plus" @click="add">添加上下文</el-button>
    </div>
  </div>
</template>
