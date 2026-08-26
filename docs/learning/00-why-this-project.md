# 为什么一条饮品偏好值得做成一个项目？

如果应用只需保存“alice 晚上喝低因咖啡”，一张数据库表就够了。本项目的价值不在于把这句话存进去，而在于记忆被修正、反复检索、跨用户使用以及收到反馈以后，仍能回答：**这条结论来自哪里、现在该用哪个版本、这次结果究竟有没有帮助？**

本章用项目自带的 [五步示例](../../examples/first_memory.py) 建立整体认识。这里的饮品偏好是教学用例，不代表服务能自动理解任意聊天内容。请求方已经提供 `key`、`value`、`context`、原话和置信度；当前写入链路负责校验、记录和管理它们。

## 先看普通表会遇到什么问题

假设表中只有 `user_id, key, value`，第一天写入 `alice, evening_drink, decaf coffee`。第二天 Alice 说“其实晚上改喝花草茶了”。直接把 value 改成 `herbal tea`，当前查询能用，但旧值、旧依据及变更时间消失了。若某次推荐仍用了旧值，也无法准确核对它来自哪一版。

本项目将这些事情分开：

| 当时的问题 | 对应的记录 | 本例中的内容 |
| --- | --- | --- |
| 收到了什么？ | Observation、EvidenceSpan | “晚上我只喝低因咖啡”及其来源 |
| 当前认为是什么？ | MemoryRecord、MemoryRevision | `drink.preference = decaf coffee` 的第 1 版；改口后是 `herbal tea` 的第 2 版 |
| 这次找到了什么？ | RecallTrace | 查询、命中的具体 revision、排序和分数 |
| 使用后效果如何？ | OutcomeEvent、UtilityEstimate | 对某次 Trace 中的 revision 提交“有帮助” |

这些是不同的事实。**召回十次不等于获得十份用户证据，也不等于十次成功反馈。** 召回会追加 Trace，但不会因为被读取就提高信念或效用。Outcome 才是学习上下文效用的入口；它必须能对应到一次召回。

## 沿一条真实链路看中间结果

示例的 Scope 是 `demo / alice`，偏好上下文是 `time_of_day=evening`：

1. `POST /v1/preferences` 提交原话与结构化偏好，得到稳定的 `record_id` 和第 1 版 `revision_id`。写入逻辑先保存证据，再接受候选偏好。
2. `GET /v1/preferences` 在这个 Scope 中列出当前偏好。本次实测得到 1 条。
3. `POST /v1/recall` 查询“晚上应该准备什么饮料”，本次实测首项为 `decaf coffee`，并得到 `trace_id`。这证明当前查询命中了该版本，还不能证明建议被使用或用户满意。
4. `POST /v1/outcomes` 携带 Trace 与命中 revision，提交一次 `helpful`。本次实测的上下文效用均值由默认 `0.5` 变为约 `0.667`；这不会把原话改写成新事实。
5. `POST /v1/preferences/{record_id}/corrections` 追加 `herbal tea`，仍使用原 record；历史查询返回 `['decaf coffee', 'herbal tea']`。当前版本前进，旧版本可追溯。

看 [示例脚本](../../examples/first_memory.py) 的请求字段，再看 [HTTP 入口](../../src/memoryloom/api/app.py) 如何构造命令，最后看 [应用服务](../../src/memoryloom/application/service.py) 的 `remember_preference`、`recall` 和 `record_outcome`。不要一开始通读所有文件；先找出每一步的输入、检查、保存对象和返回值。

## 这套机制何时值得用？

当应用需要可追溯修正、按用户/租户隔离、带上下文的召回以及可归因反馈时，这套拆分能明确回答“为什么返回这条、当时是哪一版、反馈属于哪次使用”。如果只是单机存几项固定设置，简单表通常更省成本。

当前原生启动默认使用进程内存，重启即清空；原生模式只用词法召回。PostgreSQL、Milvus 和受控策略演化有独立配置与运维前提，不能因仓库含有这些代码就认定本机已经启用。项目也没有在这条链路中自动从任意对话提取偏好，更没有证明真实业务或生产环境的答案质量。

**自测**：若只调用了召回接口，没有提交 Outcome，哪些记录会增加？当前偏好的信念和效用会改变吗？先预测，再读 [召回与反馈](02-recall-and-feedback.md) 核对。接下来按 [学习入口](README.md) 的顺序，先追写入与修正。

源码核对与本地实测：2026-11-02，基线为本仓库当前主分支。实测范围见 [证据与验证范围](06-evidence.md)。
