<script setup lang="ts">
import zhCn from "element-plus/es/locale/lang/zh-cn";

import AppShell from "@/layouts/AppShell.vue";
</script>

<template>
  <el-config-provider :locale="zhCn">
    <AppShell>
      <router-view v-slot="{ Component }">
        <transition name="view" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </AppShell>
  </el-config-provider>
</template>

<style scoped>
.view-enter-active,
.view-leave-active {
  transition:
    opacity 140ms var(--ease),
    transform 140ms var(--ease);
}

.view-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.view-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
