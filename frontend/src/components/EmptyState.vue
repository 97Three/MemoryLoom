<script setup lang="ts">
defineProps<{ title: string; copy: string }>();
</script>

<template>
  <div class="empty">
    <div class="empty-ico">
      <slot name="icon" />
    </div>
    <h3>{{ title }}</h3>
    <p>{{ copy }}</p>
    <slot name="action" />
  </div>
</template>
