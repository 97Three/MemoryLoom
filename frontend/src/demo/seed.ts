/**
 * Demo dataset for the console's "载入演示数据" action.
 *
 * Kept byte-for-byte in sync with `examples/seed_demo.py` so a dataset seeded from
 * the CLI and one seeded from the browser share the same idempotency keys and never
 * duplicate records.
 */

export interface DemoMemory {
  slug: string;
  key: string;
  value: string;
  context: Record<string, string>;
  evidence: string;
  confidence: number;
  source: string;
}

export const DEMO_MEMORIES: DemoMemory[] = [
  {
    slug: "morning-coffee",
    key: "drink.preference",
    value: "燕麦拿铁",
    context: { time_of_day: "morning" },
    evidence: "早上我一般一杯燕麦拿铁，不加糖",
    confidence: 0.88,
    source: "conversation",
  },
  {
    slug: "evening-decaf",
    key: "drink.preference",
    value: "低因咖啡",
    context: { time_of_day: "evening" },
    evidence: "晚上我只喝低因咖啡",
    confidence: 0.92,
    source: "conversation",
  },
  {
    // Same key + context as the record above: this appends a superseding revision.
    slug: "evening-tea",
    key: "drink.preference",
    value: "花草茶",
    context: { time_of_day: "evening" },
    evidence: "晚上还是算了，改喝花草茶",
    confidence: 0.9,
    source: "user_feedback",
  },
  {
    slug: "dinner-spice",
    key: "food.spice",
    value: "微辣",
    context: { meal: "dinner" },
    evidence: "晚饭微辣就行，太辣我吃不下",
    confidence: 0.8,
    source: "conversation",
  },
  {
    slug: "focus-window",
    key: "work.focus_window",
    value: "上午 9-11 点",
    context: { day: "workday" },
    evidence: "我上午思路最清楚，重活尽量排上午",
    confidence: 0.75,
    source: "conversation",
  },
  {
    slug: "commute-route",
    key: "commute.route",
    value: "地铁 6 号线",
    context: { day: "workday" },
    evidence: "上班一般坐 6 号线，换乘少",
    confidence: 0.7,
    source: "conversation",
  },
  {
    slug: "notify-channel",
    key: "notification.channel",
    value: "企业微信",
    context: { urgency: "normal" },
    evidence: "不急的事发我企业微信，别发邮件",
    confidence: 0.85,
    source: "conversation",
  },
  {
    slug: "reading-format",
    key: "reading.format",
    value: "打印出来看",
    context: { task: "review" },
    evidence: "长文档我打印出来看，屏幕上看不进去",
    confidence: 0.65,
    source: "conversation",
  },
];
