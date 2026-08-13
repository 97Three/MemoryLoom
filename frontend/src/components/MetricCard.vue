<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    foot?: string;
    hero?: boolean;
  }>(),
  { foot: "", hero: false },
);
</script>

<template>
  <article class="kpi" :class="{ 'is-hero': hero }">
    <div class="kpi-label">
      <span>{{ label }}</span>
      <span class="kpi-ico">
        <slot name="icon" />
      </span>
    </div>
    <div class="kpi-value">{{ value }}</div>
    <div v-if="foot" class="kpi-foot">{{ foot }}</div>
  </article>
</template>
