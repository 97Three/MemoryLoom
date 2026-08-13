<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Aim } from "@element-plus/icons-vue";

import { useConsole } from "@/stores/console";

const store = useConsole();
const open = ref(false);
const tenant = ref(store.scope.tenant_id);
const subject = ref(store.scope.subject_id);
const busy = ref(false);

const valid = computed(() => Boolean(tenant.value.trim() && subject.value.trim()));
const dirty = computed(
  () => tenant.value.trim() !== store.scope.tenant_id || subject.value.trim() !== store.scope.subject_id,
);

watch(open, (value) => {
  if (value) {
    tenant.value = store.scope.tenant_id;
    subject.value = store.scope.subject_id;
  }
});

async function apply(): Promise<void> {
  if (!valid.value) {
    ElMessage.warning("租户和用户都不能为空");
    return;
  }
  busy.value = true;
  try {
    const result = await store.applyScope({ tenant_id: tenant.value, subject_id: subject.value });
    if (result.error) {
      ElMessage.error(result.error);
      return;
    }
    open.value = false;
    ElMessage.success(
      result.changed
        ? `已切换到 ${store.scopeLabel}，旧作用域的请求与结果已清除`
        : `仍在使用 ${store.scopeLabel}，已刷新当前记忆`,
    );
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <el-popover v-model:visible="open" placement="bottom-end" :width="320" trigger="click">
    <template #reference>
      <button class="scope-pill" type="button" :title="store.authMode === 'jwt' ? '授权目标' : '开发作用域'">
        <span class="dot" aria-hidden="true" />
        <span>{{ store.scope.tenant_id }}</span>
        <span class="divider">/</span>
        <span>{{ store.scope.subject_id }}</span>
        <span v-if="store.draftDirty" class="draft">待应用</span>
      </button>
    </template>

    <div class="scope-pop">
      <p class="scope-title">
        <el-icon><Aim /></el-icon>
        {{ store.authMode === "jwt" ? "授权目标" : "开发作用域" }}
      </p>
      <p class="hint">
        每次操作都必须明确数据属于谁。开发模式下由请求体声明；生产模式必须从可信 token 派生。
      </p>
      <label class="label" for="scope-tenant">租户 tenant_id</label>
      <el-input id="scope-tenant" v-model="tenant" placeholder="demo" @keyup.enter="apply" />
      <label class="label" for="scope-subject">用户 subject_id</label>
      <el-input id="scope-subject" v-model="subject" placeholder="alice" @keyup.enter="apply" />
      <div class="scope-actions">
        <span class="hint">{{ dirty ? "草稿已修改" : "当前已应用" }}</span>
        <el-button type="primary" size="small" :loading="busy" :disabled="!valid" @click="apply">
          应用
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.scope-pop {
  display: grid;
  gap: 6px;
}

.scope-title {
  margin: 0 0 2px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
}

.scope-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}
</style>
