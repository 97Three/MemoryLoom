# MemoryLoom Console

记忆工作台的前端：Vue 3 单页应用，构建产物由 `memoryloom-frontend`（Python 标准库静态服务器）托管。

## 技术栈

| 层 | 选择 |
| --- | --- |
| 框架 | Vue 3.5 `<script setup>` + TypeScript（strict） |
| 构建 | Vite 6（`outDir` 直接指向包的静态目录） |
| 状态 | Pinia（Scope、健康状态、教学进度、幂等请求） |
| 路由 | Vue Router 4，**hash 模式**（静态服务器没有 rewrite 规则） |
| 组件 | Element Plus（只作为行为层，视觉由设计令牌决定） |
| 样式 | SCSS：`tokens.scss` + `base.scss` + `element-override.scss` |

## 命令

```bash
pnpm install
pnpm dev        # 开发服务器 http://127.0.0.1:5174
pnpm build      # vue-tsc --noEmit && vite build → ../src/memoryloom/api/static
pnpm typecheck
```

开发服务器需要后端同时在跑，并让后端 CORS 允许 `http://127.0.0.1:5174`：

```bash
MEMORYLOOM_CORS_ORIGINS=http://127.0.0.1:5174 uv run memoryloom
```

## 三条硬约束

1. **不引入内联脚本**：静态服务器发送 `script-src 'self'`，`vite.config.ts` 因此关闭 `modulePreload` 垫片。
2. **API 地址来自运行时**：只读 `globalThis.MEMORYLOOM_RUNTIME_CONFIG.apiBaseUrl`，由 `/runtime-config.js` 下发；构建期不写死地址。
3. **读取不改变信念**：前端不做任何本地记忆缓存，列表与召回永远是后端权威状态的投影。

## 目录

```text
src/
├── api/            # client.ts（超时/取消/错误映射）、memory.ts（端点）、types.ts（DTO）
├── stores/         # console.ts：Scope 世代号、请求通道取消、幂等键、健康状态
├── layouts/        # AppShell.vue：顶部导航、作用域切换、状态胶囊、新手引导入口
├── components/     # PageHeader、MetricCard、ContextEditor、ScorePanel、对话框
├── views/          # overview / capture / memories / recall / architecture
└── styles/         # tokens.scss、base.scss、element-override.scss
```

## 设计语言

白底 + 蓝主色 + 柔光层次。渐变只允许出现在四个位置：主按钮、唯一的主指标卡、品牌标记、数据填充。一屏之内阴影不超过三层；数字一律 `tabular-nums`。
