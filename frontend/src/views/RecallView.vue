<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { Search } from "@element-plus/icons-vue";

import ContextEditor, { type Facet } from "@/components/ContextEditor.vue";
import CorrectionDialog, { type CorrectionTarget } from "@/components/CorrectionDialog.vue";
import EmptyState from "@/components/EmptyState.vue";
import HistoryDialog from "@/components/HistoryDialog.vue";
import PageHeader from "@/components/PageHeader.vue";
import ScorePanel from "@/components/ScorePanel.vue";
import { describeError, isCancelled } from "@/api/client";
import { memoryApi } from "@/api/memory";
import type { RecallItem, RecallTrace } from "@/api/types";
import { formatDate, shortId } from "@/utils/format";
import { useConsole, ScopeChangedError } from "@/stores/console";

const store = useConsole();
const route = useRoute();

const query = ref("");
const facets = ref<Facet[]>([{ key: "time_of_day", value: "evening" }]);
const limit = ref(5);
const trace = ref<RecallTrace | null>(null);
const busy = ref(false);
const outcomeNotes = reactive<Record<string, string>>({});
const outcomeChoice = reactive<Record<string, "helpful" | "rejected">>({});
const busyOutcome = reactive<Record<string, boolean>>({});

const historyOpen = ref(false);
const historyRecord = ref<string | null>(null);
const correctionOpen = ref(false);
const correctionTarget = ref<CorrectionTarget | null>(null);

const examples = ["晚上应该准备什么饮料？", "我更喜欢喝什么？", "工作日早上喝什么"];

function readContext(): Record<string, string> {
  const context: Record<string, string> = {};
  for (const facet of facets.value) {
    const key = facet.key.trim();
    const value = facet.value.trim();
    if (!key && !value) continue;
    if (!key || !value) throw new Error("上下文的键和值必须同时填写");
    if (key in context) throw new Error(`上下文键「${key}」重复`);
    context[key] = value;
  }
  return context;
}

async function submit(): Promise<void> {
  const text = query.value.trim();
  if (!text) {
    ElMessage.warning("请输入要召回的内容");
    return;
  }
  let context: Record<string, string>;
  try {
    context = readContext();
  } catch (error) {
    ElMessage.warning(describeError(error));
    return;
  }
  busy.value = true;
  for (const key of Object.keys(outcomeNotes)) delete outcomeNotes[key];
  try {
    const result = await store.scoped("recall", (signal) =>
      memoryApi.recall(
        { ...store.scope, query: text, context, limit: limit.value },
        signal,
      ),
    );
    trace.value = result;
    store.lastTrace = result;
    store.bumpCount("recalls");
    store.counts = { ...store.counts, results: result.items.length };
    store.markJourney("recall");
    store.addActivity("recall", "执行上下文召回", `「${text}」· ${result.items.length} 条结果`);
  } catch (error) {
    if (isCancelled(error) || error instanceof ScopeChangedError) return;
    ElMessage.error(describeError(error));
  } finally {
    busy.value = false;
  }
}

async function recordOutcome(item: RecallItem, kind: "helpful" | "rejected"): Promise<void> {
  const current = trace.value;
  if (!current) return;
  const operation = `outcome:${current.trace_id}:${item.revision_id}`;
  const payload = {
    ...store.scope,
    trace_id: current.trace_id,
    revision_id: item.revision_id,
    kind,
    weight: 1,
    note: "提交自 MemoryLoom 记忆工作台",
  };
  busyOutcome[item.revision_id] = true;
  try {
    const result = await store.scoped(operation, (signal) =>
      memoryApi.outcome(
        {
          ...payload,
          idempotency_key: store.idempotency("memoryloom:outcome", payload),
        },
        signal,
      ),
    );
    outcomeNotes[item.revision_id] =
      `上下文效用已更新为 ${result.utility.mean.toFixed(3)}（样本权重 ${result.utility.sample_weight.toFixed(1)}）`;
    outcomeChoice[item.revision_id] = kind;
    store.bumpCount("outcomes", result.idempotent_replay ? 0 : 1);
    store.markJourney("outcome");
    store.addActivity("outcome", "记录可归因结果", `${item.key} · ${kind === "helpful" ? "有帮助" : "无帮助"}`);
    ElMessage.success(`效用均值更新为 ${result.utility.mean.toFixed(3)}`);
  } catch (error) {
    if (isCancelled(error) || error instanceof ScopeChangedError) return;
    ElMessage.error(describeError(error));
  } finally {
    busyOutcome[item.revision_id] = false;
  }
}

function openHistory(recordId: string): void {
  historyRecord.value = recordId;
  historyOpen.value = true;
}

function openCorrection(item: RecallItem): void {
  correctionTarget.value = {
    record_id: item.record_id,
    revision_id: item.revision_id,
    key: item.key,
    value: item.value,
  };
  correctionOpen.value = true;
}

onMounted(() => {
  const preset = route.query.q;
  if (typeof preset === "string" && preset.trim()) query.value = preset;
});
</script>

<template>
  <PageHeader
    eyebrow="CONTEXTUAL RECALL"
    title="记忆召回"
    sub="查找就是按当前场景，从记忆里挑出最相关的几条。每次查找都会留下一份记录，方便回头解释「为什么是它」。"
  >
    <template #icon>
      <el-icon :size="20"><Search /></el-icon>
    </template>
  </PageHeader>

  <article class="card">
    <form class="form" @submit.prevent="submit">
      <div class="field">
        <label class="label" for="recall-query">要召回什么</label>
        <el-input
          id="recall-query"
          v-model="query"
          size="large"
          placeholder="例如：晚上应该准备什么饮料？"
        />
      </div>
      <div class="field">
        <label class="label">当前上下文<span class="opt">上下文可以跨越词面差异，但不构成相关性证据</span></label>
        <ContextEditor v-model="facets" />
      </div>
      <div class="form-actions">
        <el-button type="primary" native-type="submit" :loading="busy">开始召回</el-button>
        <el-input-number v-model="limit" :min="1" :max="100" size="small" />
        <span class="hint">返回上限</span>
        <span class="spacer" />
        <el-button
          v-for="example in examples"
          :key="example"
          size="small"
          text
          @click="query = example"
        >
          {{ example }}
        </el-button>
      </div>
    </form>
  </article>

  <article v-if="trace" class="card" style="margin-top: 14px">
    <div class="card-head">
      <div>
        <h2 class="card-title">{{ trace.items.length }} 条结果</h2>
        <p class="card-sub">
          Policy v{{ trace.policy_version }} · Trace
          <code class="mono">{{ shortId(trace.trace_id) }}</code> · {{ formatDate(trace.created_at) }}
        </p>
      </div>
      <div class="chips">
        <span class="chip">valid_at {{ formatDate(trace.valid_at) }}</span>
        <span class="chip">known_at {{ formatDate(trace.known_at) }}</span>
      </div>
    </div>

    <div v-if="trace.items.length" class="stack">
      <article v-for="item in trace.items" :key="item.revision_id" class="result-card">
        <div>
          <div class="result-head">
            <span class="rank">{{ String(item.rank).padStart(2, "0") }}</span>
            <div>
              <span class="result-key">{{ item.key }}</span>
              <p class="result-value">{{ item.value }}</p>
              <div class="chips">
                <span v-if="!Object.keys(item.context).length" class="chip">通用上下文</span>
                <span v-for="(value, key) in item.context" :key="key" class="chip">
                  {{ key }}: <b>{{ value }}</b>
                </span>
              </div>
            </div>
          </div>
          <div class="result-actions">
            <el-button size="small" @click="openHistory(item.record_id)">查看历史</el-button>
            <el-button size="small" @click="openCorrection(item)">修正记忆</el-button>
            <el-button
              size="small"
              type="success"
              :plain="outcomeChoice[item.revision_id] !== 'helpful'"
              :loading="busyOutcome[item.revision_id]"
              @click="recordOutcome(item, 'helpful')"
            >
              有帮助
            </el-button>
            <el-button
              size="small"
              type="danger"
              :plain="outcomeChoice[item.revision_id] !== 'rejected'"
              :loading="busyOutcome[item.revision_id]"
              @click="recordOutcome(item, 'rejected')"
            >
              无帮助
            </el-button>
          </div>
        </div>
        <ScorePanel :item="item" :utility-note="outcomeNotes[item.revision_id]" />
      </article>
      <p class="notice">
        下一步：按真实使用结果选「有帮助」或「无帮助」。只有落在这条记录上的反馈，才会改变它下次的排序。
      </p>
    </div>

    <EmptyState
      v-else
      title="没有达到阈值的记忆"
      copy="调整查询措辞或上下文再试。这次空结果同样留下了独立 Trace，可被审计。"
    >
      <template #icon><el-icon :size="22"><Search /></el-icon></template>
    </EmptyState>
  </article>

  <EmptyState
    v-else
    title="还没有执行召回"
    copy="召回会冻结本次的双时间边界、策略版本和评分拆解，并把结果写进一条不可变 Trace。"
  >
    <template #icon><el-icon :size="22"><Search /></el-icon></template>
  </EmptyState>

  <HistoryDialog v-model="historyOpen" :record-id="historyRecord" />
  <CorrectionDialog
    v-model="correctionOpen"
    :target="correctionTarget"
    @saved="() => store.loadMemories(true)"
  />
</template>
