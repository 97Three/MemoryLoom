<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { useConsole } from "@/stores/console";

const store = useConsole();
const index = ref(0);

const steps = [
  {
    eyebrow: "01 · 数据属于谁",
    title: "先确认数据属于谁",
    copy: "每次操作都要说明这是哪个租户、哪个用户的数据。默认 demo / alice 适合本地体验，也顺手演示了隔离。",
    points: ["租户之间互相看不到。", "同一个租户里，用户之间也互相看不到。", "切换作用域会清掉旧请求和旧结果。"],
  },
  {
    eyebrow: "02 · 原话与结论",
    title: "记忆从原话开始",
    copy: "系统先把用户说的原话存下来，再记成一条带场景、带可信度的结论；以后修正只会新增一条，原话永远保留。",
    points: ["记忆键说明这是哪一类事实。", "同一个键在不同场景下可以有多条结论。", "可信度说的是「有多确定」，不是「有没有用」。"],
  },
  {
    eyebrow: "03 · 怎么找出来",
    title: "查找会留下可回看的记录",
    copy: "每次查找都会记下：当时的时间点、用了哪套排序规则、每条为什么得分。翻看本身不会改变任何记忆。",
    points: ["相关性、场景、可信度、有用程度、时效共同决定排序。", "没找到也算一次查找，同样留下记录。", "得分明细让你能解释「为什么它排第一」。"],
  },
  {
    eyebrow: "04 · 有没有用",
    title: "只有真实结果才会改变它",
    copy: "点「有帮助 / 无帮助」时，这条评价必须落在刚才那次查找上。看得多不会让记忆变得更可信。",
    points: ["评价和那次查找、那条记忆绑定在一起。", "有用程度按成功 / 失败加权累计。", "这是它学习「有没有用」的唯一入口。"],
  },
];

const visible = computed({
  get: () => store.tourOpen,
  set: (value: boolean) => {
    if (!value) store.closeTour();
  },
});

const current = computed(() => steps[index.value]);
const last = computed(() => index.value === steps.length - 1);

watch(
  () => store.tourOpen,
  (open) => {
    if (open) index.value = 0;
  },
);

function next(): void {
  if (last.value) store.closeTour();
  else index.value += 1;
}
</script>

<template>
  <el-dialog v-model="visible" width="560px" align-center :show-close="false" append-to-body>
    <template #header>
      <span class="sr-only">新手引导</span>
    </template>
    <section class="tour">
      <p class="eyebrow">{{ current.eyebrow }}</p>
      <h2 class="tour-title">{{ current.title }}</h2>
      <p class="tour-copy">{{ current.copy }}</p>
      <ul class="tour-points">
        <li v-for="point in current.points" :key="point">{{ point }}</li>
      </ul>
      <div class="tour-dots" role="tablist" aria-label="引导步骤">
        <button
          v-for="(step, position) in steps"
          :key="step.eyebrow"
          type="button"
          role="tab"
          class="tour-dot"
          :class="{ 'is-on': position === index }"
          :aria-selected="position === index"
          :aria-label="`第 ${position + 1} 步`"
          @click="index = position"
        />
      </div>
    </section>
    <template #footer>
      <div class="tour-actions">
        <el-button text @click="store.closeTour()">跳过</el-button>
        <span class="spacer" />
        <el-button :disabled="index === 0" @click="index -= 1">上一步</el-button>
        <el-button type="primary" @click="next">{{ last ? "开始使用" : "下一步" }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.tour {
  display: grid;
  gap: 10px;
  padding: 4px 0 6px;
}

.tour-title {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.6px;
}

.tour-copy {
  margin: 0;
  font-size: 13px;
  color: var(--ink2);
}

.tour-points {
  margin: 2px 0 6px;
  padding-left: 18px;
  color: var(--ink3);
  font-size: 12.5px;
  display: grid;
  gap: 4px;
}

.tour-dots {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.tour-dot {
  width: 22px;
  height: 4px;
  border: none;
  border-radius: 3px;
  background: var(--line);
  cursor: pointer;
  padding: 0;
}

.tour-dot.is-on {
  background: linear-gradient(90deg, var(--brand), var(--brand2));
}

.tour-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tour-actions .spacer {
  flex: 1 1 auto;
}
</style>
