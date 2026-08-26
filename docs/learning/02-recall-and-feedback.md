# 查到了偏好，为什么还不能说它有帮助？

用户问“晚上喝什么”，系统找到“晚间低因咖啡”，只证明这条记录与当前问题匹配。它还没证明建议真正送到用户面前，更没证明用户满意。这个差别决定了系统能否避免“自己读得越多，越相信自己”。

## 召回先筛选，再评分，最后冻结当次结果

在 [src/memoryloom/application/service.py](D:/Code/memoryloom/src/memoryloom/application/service.py) 的 `recall` 中，先校验查询和 limit，再一次性读取时钟，确定 `valid_at` 与 `known_at`。随后从权威存储取得该 Scope、该时间边界下可见的快照；配置了向量投影时，再请求向量候选。

每条候选会得到多个分量：词法/向量相关度、情境匹配、信念置信度、历史结果效用、时效。这里 semantic 分量取词法与向量分数的较大值，变量名不意味着一定调用了语义模型。候选还要经过相关性准入，不能只因置信度很高就召回与问题无关的偏好。

[src/memoryloom/domain/evolution.py](D:/Code/memoryloom/src/memoryloom/domain/evolution.py) 默认权重为 0.35、0.25、0.20、0.15、0.05。教学计算：若五项依次是 0.8、1、0.92、0.5、1，则加权和为 `0.28+0.25+0.184+0.075+0.05=0.839`。这仅演示公式，实际分数须读取当次 Trace，并且先满足准入条件。

排序和 limit 截取后，RecallTrace 固定本次命中的 revision、排名、分数拆解、时间与策略版本。后来记忆修改了，原 Trace 仍记录当时用的是哪个版本。

## 从 Trace 到模型上下文，还会丢掉一些内容

[src/memoryloom/application/compression.py](D:/Code/memoryloom/src/memoryloom/application/compression.py) 的 `RecallContextCompressor.project` 提供排序抽取和精确去重。它先将每项序列化成确定性 JSON，再按字符预算选择完整项。某条太长时跳过，继续看后面的条目，而不是把事实截断一半。

例如 Trace 有 r1、r2、r3，预算只能放下 r1 和 r3，最终投影只应归因到这两项。精确去重可以合并相同片段并保留多个来源，但不会让 LLM 概括生成新事实。字符数也不是 token 数。

投影包含配置摘要、来源摘要和结果摘要。摘要是用来核对“是不是同一个确定性结果”，不是证明自然语言内容真实的魔法。

## Usage 与 Outcome 各自证明什么

`record_usage` 从原 Trace 重建投影，核对 `source_projection_sha256`，并要求提交的 revision 集合属于真实投影。消费者另外提供实际交付上下文的摘要。服务能校验引用关系，不能仅凭摘要证明用户真的阅读过文本。

`record_outcome` 要求 Trace 存在于同一个 Scope；提供 usage ID 时，目标 revision 还必须属于那次 usage。当前底层 API 也允许不提供 usage ID，而退回检查 Trace 成员关系。因此“所有调用都强制 Usage”不是准确描述；更严格的应用接入流程应明确选择 Usage 归因。

## 效用怎样变化：算给自己看

[src/memoryloom/domain/experience.py](D:/Code/memoryloom/src/memoryloom/domain/experience.py) 的 `UtilityEstimate.mean`：

```text
效用均值 = (1 + 正向权重) / (2 + 正向权重 + 负向权重)
```

初始没有反馈为 1/2；一次权重 1 的 helpful 后是 2/3；再一次权重 1 的 rejected 后是 2/4。这里统计的是某修订在某上下文中有用的程度，不是它作为事实的置信度。重复同一个 Outcome 幂等键不能再次加权。

对应验证在 [tests/test_memory_application.py](D:/Code/memoryloom/tests/test_memory_application.py)：`test_recall_does_not_reinforce_belief_or_utility`、`test_attributable_outcome_updates_contextual_utility_once`、`test_usage_receipt_binds_outcome_to_the_delivered_projection`。压缩边界见 [tests/test_compression.py](D:/Code/memoryloom/tests/test_compression.py)。

练习：把投影预算缩小，找到被省略的 revision，再预测它能否出现在 Usage。完成标志是能分别说明“召回了、放进上下文了、产生了有用结果”所需的证据。不要用一次任务成功替代用户对每条偏好的明确评价。
