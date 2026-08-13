<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";

import { memoryApi } from "@/api/memory";
import { describeError, isCancelled } from "@/api/client";
import { useConsole, ScopeChangedError } from "@/stores/console";

export interface CorrectionTarget {
  record_id: string;
  revision_id: string;
  key: string;
  value: string;
}

const props = defineProps<{ modelValue: boolean; target: CorrectionTarget | null }>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  saved: [sequence: number];
}>();

const store = useConsole();
const busy = ref(false);
const form = reactive({ value: "", evidence: "", reason: "", source: "conversation" });

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

watch(
  () => props.target,
  (target) => {
    if (!target) return;
    form.value = target.value;
    form.evidence = "";
    form.reason = "";
    form.source = "conversation";
  },
  { immediate: true },
);

async function submit(): Promise<void> {
  const target = props.target;
  if (!target) return;
  const value = form.value.trim();
  const evidence = form.evidence.trim();
  const reason = form.reason.trim();
  if (!value || !evidence || !reason) {
    ElMessage.warning("新值、新证据与修正原因都必须填写");
    return;
  }
  const operation = `correction:${target.record_id}`;
  busy.value = true;
  try {
    const body = {
      ...store.scope,
      source: form.source.trim() || "conversation",
      idempotency_key: store.idempotency("memoryloom:correction", {
        ...store.scope,
        source: form.source.trim(),
        value,
        evidence_text: evidence,
        reason,
        expected_revision_id: target.revision_id,
      }),
      value,
      evidence_text: evidence,
      reason,
      expected_revision_id: target.revision_id,
    };
    const result = await store.scoped(operation, (signal) =>
      memoryApi.correct(target.record_id, body, signal),
    );
    store.bumpCount("writes", result.idempotent_replay ? 0 : 1);
    store.markJourney("write");
    store.addActivity("correction", "追加记忆修订", `${value} · Revision #${result.sequence}`);
    emit("saved", result.sequence);
    visible.value = false;
    ElMessage.success(`修订已追加为 #${result.sequence}，重新召回即可看到新值`);
  } catch (caught) {
    if (isCancelled(caught) || caught instanceof ScopeChangedError) return;
    ElMessage.error(describeError(caught));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="追加一条修订" width="560px" align-center>
    <p class="hint">
      旧版本会保留在历史里。目标是 {{ props.target?.key ?? "这条记忆" }} 的当前修订
      <code>{{ props.target ? props.target.revision_id.slice(0, 8) : "" }}</code>。
    </p>
    <div class="form">
      <div class="field">
        <label class="label" for="correction-value">新的值</label>
        <el-input id="correction-value" v-model="form.value" placeholder="例如 herbal tea" />
      </div>
      <div class="field">
        <label class="label" for="correction-evidence">新证据<span class="opt">用户原话</span></label>
        <el-input
          id="correction-evidence"
          v-model="form.evidence"
          type="textarea"
          :rows="2"
          placeholder="例如 其实晚上我改喝花草茶"
        />
      </div>
      <div class="field">
        <label class="label" for="correction-reason">修正原因</label>
        <el-input id="correction-reason" v-model="form.reason" placeholder="例如 用户主动更正" />
      </div>
      <div class="field">
        <label class="label" for="correction-source">来源</label>
        <el-input id="correction-source" v-model="form.source" placeholder="conversation" />
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="busy" @click="submit">追加修订</el-button>
    </template>
  </el-dialog>
</template>
