<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  Aim,
  ChatDotRound,
  Collection,
  MagicStick,
  Refresh,
  Search,
  TrendCharts,
} from "@element-plus/icons-vue";

import EmptyState from "@/components/EmptyState.vue";
import MetricCard from "@/components/MetricCard.vue";
import PageHeader from "@/components/PageHeader.vue";
import { formatDate, shortId } from "@/utils/format";
import { useConsole } from "@/stores/console";

const store = useConsole();
const router = useRouter();
const seeding = ref(false);

/**
 * Four plain-language steps. "Confirming the scope" is a precondition, not a task,
 * so it is rendered as a status chip instead of inflating the counter.
 */
const steps = computed(() => [
  {
    id: "write",
    title: "告诉它一件新事",
    copy: "先把用户的原话存下来，再记成一条带场景的偏好",
    done: store.journey.write,
    run: () => router.push({ name: "capture", query: { example: "1" } }),
  },
  {
    id: "view",
    title: "看看它记成了什么",
    copy: "只读；多翻几遍不会让它更自信",
    done: store.journey.view,
    run: () => router.push({ name: "memories" }),
  },
  {
    id: "recall",
    title: "拿它回答一个问题",
    copy: "按当前场景挑出最相关的几条，并留下这次查询记录",
    done: store.journey.recall,
    run: () => router.push({ name: "recall", query: { q: "晚上应该准备什么饮料" } }),
  },
  {
    id: "outcome",
    title: "告诉它这次准不准",
    copy: "只有具体的「有用 / 没用」，才会影响它下次的排序",
    done: store.journey.outcome,
    run: () => router.push({ name: "recall" }),
  },
]);

const activityIcon = { write: "+", recall: "↗", outcome: "✓", correction: "↻" } as const;

const lastRecall = computed(() => {
  const trace = store.lastTrace;
  if (!trace) return null;
  const top = trace.items[0];
  return {
    count: trace.items.length,
    policy: trace.policy_version,
    traceId: shortId(trace.trace_id),
    createdAt: formatDate(trace.created_at),
    top: top ? `${top.key} = ${top.value}` : null,
    topScore: top ? top.score.toFixed(3) : null,
  };
});

async function loadDemo(): Promise<void> {
  seeding.value = true;
  try {
    const result = await store.seedDemo();
    if (result.failed > 0) {
      ElMessage.error(
        `写入失败 ${result.failed} 条：${result.firstError ?? "未知错误"}${
          result.created > 0 ? `（成功 ${result.created} 条）` : ""
        }`,
      );
      return;
    }
    ElMessage.success(
      result.created > 0
        ? `已载入 ${result.created} 条演示记忆${result.replayed ? `，${result.replayed} 条已存在` : ""}`
        : "演示数据已存在，没有重复写入",
    );
  } finally {
    seeding.value = false;
  }
}

onMounted(() => {
  if (!store.memoriesLoaded) void store.loadMemories(true);
});
</script>

<template>
  <PageHeader
    eyebrow="MEMORYLOOM · OVERVIEW"
    title="记忆工作台"
    sub="它记得比你久，但不轻易相信自己。每条记忆都有出处、有版本、有有效期；每次查找都会留下一份记录，只有真实结果才会改变它的判断。"
  >
    <template #icon>
      <el-icon :size="20"><TrendCharts /></el-icon>
    </template>
    <template #actions>
      <el-button :icon="MagicStick" :loading="seeding" @click="loadDemo">载入演示数据</el-button>
      <el-button :icon="Refresh" :loading="store.loadingMemories" @click="store.loadMemories()">
        刷新
      </el-button>
      <el-button type="primary" :icon="Collection" @click="router.push({ name: 'capture' })">
        写入记忆
      </el-button>
    </template>
  </PageHeader>

  <section class="grid grid-kpi">
    <MetricCard
      label="已记住的事"
      :value="store.memories.length"
      :foot="`${store.scopeLabel} · 只读视图`"
      hero
    >
      <template #icon><el-icon><Collection /></el-icon></template>
    </MetricCard>
    <MetricCard label="本次写入" :value="store.counts.writes" foot="包含修正后追加的新版本">
      <template #icon><el-icon><Aim /></el-icon></template>
    </MetricCard>
    <MetricCard label="本次查找" :value="store.counts.recalls" :foot="`最近一次返回 ${store.counts.results} 条`">
      <template #icon><el-icon><Search /></el-icon></template>
    </MetricCard>
    <MetricCard label="本次评价" :value="store.counts.outcomes" foot="针对具体某条记忆的反馈">
      <template #icon><el-icon><ChatDotRound /></el-icon></template>
    </MetricCard>
  </section>

  <section class="grid grid-main">
    <article class="card">
      <div class="card-head">
        <div>
          <h2 class="card-title">四步走完一次记忆</h2>
          <p class="card-sub">已完成 {{ store.completedSteps }} / 4 步</p>
        </div>
        <div class="chips">
          <span class="chip">{{ store.scopeLabel }} 已确认</span>
        </div>
      </div>
      <div class="steps">
        <button
          v-for="(step, index) in steps"
          :key="step.id"
          type="button"
          class="step-row"
          :class="{ 'is-done': step.done }"
          @click="step.run()"
        >
          <span class="step-idx">{{ step.done ? "✓" : index + 1 }}</span>
          <span>
            <span class="step-title">{{ step.title }}</span>
            <span class="step-copy" style="display: block">{{ step.copy }}</span>
          </span>
          <span class="muted">→</span>
        </button>
      </div>
    </article>

    <div class="stack">
      <article class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">{{ store.storageTitle }}</h2>
            <p class="card-sub">{{ store.healthLabel }} · {{ store.healthDetail }}</p>
          </div>
        </div>
        <p class="hint">{{ store.storageCopy }}</p>
        <div class="chips" style="margin-top: 10px">
          <span class="chip">{{ store.authLabel }}</span>
          <span class="chip">作用域来源 <b>{{ store.authMode === "jwt" ? "token" : "request" }}</b></span>
        </div>
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">最近活动</h2>
            <p class="card-sub">只存在于当前浏览器会话</p>
          </div>
        </div>
        <div v-if="store.activities.length" class="timeline">
          <div v-for="item in store.activities" :key="item.id" class="tl-item">
            <span class="tl-dot">{{ activityIcon[item.kind] }}</span>
            <span>
              <span class="tl-title">{{ item.title }}</span>
              <span class="tl-copy" style="display: block">{{ item.detail }}</span>
              <span class="tl-copy" style="display: block">{{ formatDate(item.at) }}</span>
            </span>
          </div>
        </div>
        <EmptyState
          v-else
          title="还没有操作记录"
          copy="写入、查找与评价会按时间出现在这里，用来串起一次完整闭环。"
        >
          <template #icon><el-icon :size="22"><Refresh /></el-icon></template>
        </EmptyState>
      </article>
    </div>
  </section>

  <section class="grid grid-half">
    <article class="card">
      <div class="card-head">
        <div>
          <h2 class="card-title">最近一次查找</h2>
          <p class="card-sub">每次查找都会留下记录，可以回看当时是怎么判断的</p>
        </div>
        <el-button v-if="lastRecall" size="small" text @click="router.push({ name: 'recall' })">
          再去查找
        </el-button>
      </div>
      <div v-if="lastRecall" class="recall-summary">
        <div class="recall-figure">
          <b>{{ lastRecall.count }}</b>
          <span>条结果</span>
        </div>
        <div class="recall-meta">
          <p>
            策略 v{{ lastRecall.policy }} · 记录
            <code class="mono">{{ lastRecall.traceId }}</code> · {{ lastRecall.createdAt }}
          </p>
          <p v-if="lastRecall.top" class="recall-top">
            排第一的是 <b>{{ lastRecall.top }}</b> · 得分 {{ lastRecall.topScore }}
          </p>
          <p v-else>这次没有命中，但空结果同样留下了独立记录。</p>
        </div>
      </div>
      <EmptyState
        v-else
        title="还没有查找过"
        copy="查找会按当前场景挑出记忆，并留下一条可以回看的记录。"
      >
        <template #icon><el-icon :size="22"><Search /></el-icon></template>
        <template #action>
          <el-button @click="router.push({ name: 'recall' })">去查找</el-button>
        </template>
      </EmptyState>
    </article>

    <article class="card">
      <h2 class="card-title">为什么多看几遍不会让它更自信</h2>
      <p class="hint" style="margin-top: 8px">
        翻列表、做查找都只是「看」，不会提高任何一条记忆的可信度。只有你明确告诉它「这次有用」
        或「这次没用」，它才会调整下次的排序——这样才能避免「被看得多 → 排得更前 → 被看得更多」
        的自我强化。
      </p>
      <p class="hint" style="margin-top: 8px">
        另外，每条记忆都同时记两件事：这条事实在什么时候成立，以及系统在什么时候才知道它。
        迟到的修正因此能正确盖掉旧结论。
      </p>
    </article>
  </section>
</template>

<style scoped>
.recall-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 6px;
}

.recall-figure {
  display: grid;
  gap: 2px;
  min-width: 78px;
}

.recall-figure b {
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.recall-figure span {
  font-size: 11.5px;
  color: var(--ink4);
}

.recall-meta {
  display: grid;
  gap: 4px;
  font-size: 11.5px;
  color: var(--ink4);
}

.recall-meta p {
  margin: 0;
}

.recall-top b {
  color: var(--ink);
  font-weight: 600;
}
</style>
