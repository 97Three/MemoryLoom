<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow: string;
    title: string;
    sub?: string;
  }>(),
  { sub: "" },
);
</script>

<template>
  <div class="page-head">
    <div class="lead">
      <div class="page-tile">
        <slot name="icon" />
      </div>
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1 class="page-title">{{ title }}</h1>
        <p v-if="sub" class="page-sub">{{ sub }}</p>
      </div>
    </div>
    <div class="head-actions">
      <slot name="actions" />
    </div>
  </div>
</template>
