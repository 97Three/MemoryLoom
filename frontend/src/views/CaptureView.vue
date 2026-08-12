<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DocumentAdd, MagicStick } from "@element-plus/icons-vue";

import ContextEditor, { type Facet } from "@/components/ContextEditor.vue";
import PageHeader from "@/components/PageHeader.vue";
import { describeError, isCancelled } from "@/api/client";
import { memoryApi } from "@/api/memory";
import type { PreferenceResult } from "@/api/types";
import { shortId } from "@/utils/format";
import { useConsole, ScopeChangedError } from "@/stores/console";

const store = useConsole();
const route = useRoute();
const router = useRouter();

const form = reactive({ key: "", value: "", source: "conversation", confidence: 0.92, evidence: "" });
const facets = ref<Facet[]>([{ key: "time_of_day", value: "evening" }]);
const result = ref<PreferenceResult | null>(null);
const busy = ref(false);

const confidencePercent = computed(() => `${Math.round(form.confidence * 100)}%`);

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

function loadExample(): void {
  form.key = "drink.preference";
  form.value = "decaf coffee";
  form.source = "conversation";
  form.confidence = 0.92;
  form.evidence = "晚上我只喝低因咖啡";
  facets.value = [{ key: "time_of_day", value: "evening" }];
  ElMessage.success("示例已载入：检查字段后点“保存为记忆”");
}

function reset(): void {
  form.key = "";
  form.value = "";
  form.source = "conversation";
  form.confidence = 0.92;
  form.evidence = "";
  facets.value = [{ key: "time_of_day", value: "evening" }];
  result.value = null;
}

async function submit(): Promise<void> {
  const key = form.key.trim();
  const value = form.value.trim();
  const evidence = form.evidence.trim();
  if (!key || !value || !evidence) {
    ElMessage.warning("记忆键、当前值与原始证据都必须填写");
    return;
  }
  let context: Record<string, string>;
  try {
    context = readContext();
  } catch (error) {
    ElMessage.warning(describeError(error));
    return;
  }
  const payload = {
    ...store.scope,
    source: form.source.trim() || "conversation",
    key,
    value,
    context,
    evidence_text: evidence,
    confidence: form.confidence,
  };
  busy.value = true;
  try {
    const saved = await store.scoped("preference-write", (signal) =>
      memoryApi.remember(
        {
          ...payload,
          idempotency_key: store.idempotency("memoryloom:preference", payload),
        },
        signal,
      ),
    );
    result.value = saved;
    store.bumpCount("writes", saved.idempotent_replay ? 0 : 1);
    store.markJourney("write");
    store.addActivity("write", "写入偏好记忆", `${key} = ${value}`);
    ElMessage.success(`已创建 Revision #${saved.sequence}`);
    void store.loadMemories(true);
  } catch (error) {
    if (isCancelled(error) || error instanceof ScopeChangedError) return;
    ElMessage.error(describeError(error));
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  if (route.query.example) loadExample();
});
</script>

<template>
  <PageHeader
    eyebrow="CAPTURE EVIDENCE"
    title="写入记忆"
    sub="先把用户的原话存下来，再记成一条带场景和可信度的偏好。以后修正只会新增一条，旧的原话永远保留。"
  >
    <template #icon>
      <el-icon :size="20"><DocumentAdd /></el-icon>
    </template>
    <template #actions>
      <el-button :icon="MagicStick" @click="loadExample">载入示例</el-button>
    </template>
  </PageHeader>

  <section class="grid grid-main">
    <article class="card">
      <div class="card-head">
        <div>
          <h2 class="card-title">新的证据与偏好</h2>
          <p class="card-sub">作用域 {{ store.scopeLabel }}</p>
        </div>
      </div>

      <form class="form" @submit.prevent="submit">
        <div class="field-row">
          <div class="field">
            <label class="label" for="capture-key">记忆键</label>
            <el-input id="capture-key" v-model="form.key" placeholder="drink.preference" />
          </div>
          <div class="field">
            <label class="label" for="capture-value">当前偏好值</label>
            <el-input id="capture-value" v-model="form.value" placeholder="decaf coffee" />
          </div>
        </div>

        <div class="field">
          <label class="label" for="capture-evidence">
            原始证据<span class="opt">用户原话，不会被后续修正改写</span>
          </label>
          <el-input
            id="capture-evidence"
            v-model="form.evidence"
            type="textarea"
            :rows="3"
            placeholder="晚上我只喝低因咖啡"
          />
        </div>

        <div class="field">
          <label class="label">上下文<span class="opt">让同一偏好在不同场景中共存</span></label>
          <ContextEditor v-model="facets" />
        </div>

        <div class="field-row">
          <div class="field">
            <label class="label" for="capture-source">来源</label>
            <el-input id="capture-source" v-model="form.source" placeholder="conversation" />
          </div>
          <div class="field">
            <label class="label" for="capture-confidence">
              初始置信度<span class="opt">{{ confidencePercent }}</span>
            </label>
            <el-slider
              id="capture-confidence"
              v-model="form.confidence"
              :min="0"
              :max="1"
              :step="0.01"
              :format-tooltip="(value: number) => value.toFixed(2)"
            />
          </div>
        </div>

        <div class="form-actions">
          <el-button type="primary" native-type="submit" :loading="busy">保存为记忆</el-button>
          <el-button text @click="reset">清空</el-button>
          <span class="spacer" />
          <span class="hint">幂等键由业务字段派生，重复提交不会产生第二条记忆。</span>
        </div>
      </form>
    </article>

    <div class="stack">
      <article v-if="result" class="card">
        <div class="card-head">
          <div>
            <h2 class="card-title">
              {{ result.idempotent_replay ? "已返回原有记忆" : "记忆已保存" }}
            </h2>
            <p class="card-sub">
              {{
                result.idempotent_replay
                  ? "幂等键匹配，未重复创建数据。"
                  : `已生成第 ${result.sequence} 个不可变修订。`
              }}
            </p>
          </div>
          <el-tag size="small" type="success">Revision #{{ result.sequence }}</el-tag>
        </div>
        <div class="id-list">
          <div><span>Record</span><code class="mono" :title="result.record_id">{{ shortId(result.record_id) }}</code></div>
          <div><span>Revision</span><code class="mono" :title="result.revision_id">{{ shortId(result.revision_id) }}</code></div>
          <div><span>Evidence</span><code class="mono" :title="result.observation_id">{{ shortId(result.observation_id) }}</code></div>
        </div>
        <el-button style="margin-top: 12px" @click="router.push({ name: 'memories' })">
          下一步：查看当前记忆
        </el-button>
      </article>

      <article class="card">
        <h2 class="card-title">这一步在写什么</h2>
        <p class="hint" style="margin-top: 6px">
          术语对照：原话 = Observation，场景 = context，结论 = 一条可以修正的偏好。
        </p>
        <ul class="plain">
          <li><b>Observation</b> 与 <b>EvidenceSpan</b> 只追加，保存原始表达与最小证据。</li>
          <li><b>Candidate</b> 是从证据提出的解释，不代表系统已经相信。</li>
          <li>接受候选后生成 <b>MemoryRevision</b>，置信度与支持次数随证据累积。</li>
          <li>相同 <code>key + context</code> 再次写入时，值相同则强化，值不同则追加替代修订。</li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.id-list {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--r);
  background: #f8fafd;
}

.id-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11.5px;
  color: var(--ink3);
}

.plain {
  margin: 10px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--ink3);
}

.plain b {
  color: var(--ink2);
}
</style>
