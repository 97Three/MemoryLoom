<script setup lang="ts">
import { Share } from "@element-plus/icons-vue";

import PageHeader from "@/components/PageHeader.vue";

const planes = [
  {
    index: "01",
    name: "Evidence",
    tag: "只追加",
    copy: "Observation 保存原始输入，EvidenceSpan 指向最小证据，Candidate 是提出的解释而不是信念。",
  },
  {
    index: "02",
    name: "Belief",
    tag: "不可变修订",
    copy: "MemoryRecord 提供稳定身份，MemoryRevision 保存值、置信度与双时间；修正只追加新版本。",
  },
  {
    index: "03",
    name: "Experience",
    tag: "可归因",
    copy: "RecallTrace 冻结一次召回，OutcomeEvent 必须引用它，UtilityEstimate 才因此更新。",
  },
  {
    index: "04",
    name: "Projection",
    tag: "可丢弃",
    copy: "词法、向量与上下文压缩都是投影，可从权威修订重建；候选命中必须由权威存储复核。",
  },
  {
    index: "05",
    name: "Evolution",
    tag: "有界",
    copy: "只允许很小的检索权重变化，并通过实验状态机与签名门禁推进；永不修改授权与删除规则。",
  },
];

const endpoints = [
  { method: "GET", path: "/v1/preferences", copy: "列出当前有效偏好" },
  { method: "POST", path: "/v1/preferences", copy: "写入证据与偏好修订" },
  { method: "POST", path: "/v1/preferences/{id}/corrections", copy: "追加一条修订" },
  { method: "GET", path: "/v1/preferences/{id}/revisions", copy: "读取不可变历史" },
  { method: "POST", path: "/v1/recall", copy: "双时间召回并冻结 Trace" },
  { method: "POST", path: "/v1/recall-contexts", copy: "从 Trace 生成有界上下文投影" },
  { method: "POST", path: "/v1/usages", copy: "记录真正进入上下文的修订" },
  { method: "POST", path: "/v1/outcomes", copy: "提交可归因结果" },
];

const invariants = [
  "列表与召回不改变信念或效用。",
  "每个有状态键都包含 tenant 与 subject 作用域。",
  "Observation、修订、Trace 与 Outcome 只追加。",
  "历史效用只能使用 known_at 之前记录的 Outcome。",
  "召回必须同时满足 valid_from ≤ valid_at 与 recorded_at ≤ known_at。",
  "策略权重有绝对范围与单次变化上限，且不能降低相关性安全底线。",
];
</script>

<template>
  <PageHeader
    eyebrow="FIVE-PLANE MODEL"
    title="系统架构"
    sub="把「看到了什么」「相信什么」「用起来有没有用」拆成独立平面，才能避免记忆系统最常见的自我强化错误。"
  >
    <template #icon>
      <el-icon :size="20"><Share /></el-icon>
    </template>
  </PageHeader>

  <section class="planes">
    <article v-for="plane in planes" :key="plane.index" class="plane">
      <span class="plane-idx">{{ plane.index }}</span>
      <span class="plane-name">{{ plane.name }}</span>
      <span class="plane-tag">{{ plane.tag }}</span>
      <p class="plane-copy">{{ plane.copy }}</p>
    </article>
  </section>

  <section class="grid grid-half" style="margin-top: 14px">
    <article class="card">
      <div class="card-head">
        <div>
          <h2 class="card-title">硬不变量</h2>
          <p class="card-sub">这些约束写在领域层，不随策略演化改变</p>
        </div>
      </div>
      <ul class="invariants">
        <li v-for="rule in invariants" :key="rule">{{ rule }}</li>
      </ul>
    </article>

    <article class="card">
      <div class="card-head">
        <div>
          <h2 class="card-title">HTTP 契约</h2>
          <p class="card-sub">工作台只使用其中一部分，完整契约见 OpenAPI</p>
        </div>
      </div>
      <div class="api-list">
        <div v-for="endpoint in endpoints" :key="`${endpoint.method}${endpoint.path}`" class="api-row">
          <span class="method" :class="{ 'is-get': endpoint.method === 'GET' }">{{ endpoint.method }}</span>
          <code class="mono">{{ endpoint.path }}</code>
          <span class="hint">{{ endpoint.copy }}</span>
        </div>
      </div>
    </article>
  </section>

  <article class="card" style="margin-top: 14px">
    <h2 class="card-title">为什么它不是“向量库 + 提示词”</h2>
    <p class="hint" style="margin-top: 8px">
      向量库把「召回」当成检索，而这里把召回当成一次可审计的事实记录：它冻结时间边界、策略版本与
      评分拆解，并把结果与后续真实结果建立归因。于是系统可以回答三个不同的问题——看到了什么、
      现在相信什么、以及用起来是否真的有帮助——而不是把三者混成一条相似度分数。
    </p>
  </article>
</template>

<style scoped>
.invariants {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 7px;
  font-size: 12px;
  color: var(--ink3);
}
</style>
