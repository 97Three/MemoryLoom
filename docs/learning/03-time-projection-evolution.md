# 记忆不是一个向量表：时间、事实源与策略各管什么？

这一章处理三个容易混在一起的问题：过去有效的偏好、检索索引里的旧版本、未来使用的新策略。它们分别需要时间边界、权威存储复查和受控状态迁移。

## 两个时间：什么时候生效，什么时候知道

教学时间线：7 月 1 日记下“晚上喝咖啡”；7 月 10 日收到修正“我从 7 月 5 日起改喝水”。新修订的业务生效时间可为 7 月 5 日，系统记录时间是 7 月 10 日。

| 查询 | 应采用的信息范围 |
| --- | --- |
| valid_at=7/6，known_at=7/8 | 只能用 7/8 前已记录的信息，不能提前知道迟到修正 |
| valid_at=7/6，known_at=7/11 | 可以考虑 7/10 记录、7/5 已生效的修正 |
| valid_at=7/4，known_at=7/11 | 新修正尚未生效，应根据旧有效状态判断 |

这是历史状态投影，不是历史运行环境的完整重放：当前请求仍使用所选策略快照与当前实现。源码入口为 `memories_as_of` 与 `recall`；验证在 [tests/test_memory_application.py](D:/Code/memoryloom/tests/test_memory_application.py) 的 late correction / future correction / as_of 测试。

## PostgreSQL 是事实源，Milvus 是可重建的检索投影

数据库提交成功、向量服务暂时失败，是一个真实分布式问题。如果业务代码依次写两个系统，进程在中间退出，就可能只有一边完成。

项目的 PostgreSQL 适配器在权威状态变更的事务中追加 outbox 事件；独立 Worker 再把投影送入 Milvus。读 [src/memoryloom/adapters/postgres.py](D:/Code/memoryloom/src/memoryloom/adapters/postgres.py)、[src/memoryloom/adapters/projection_outbox.py](D:/Code/memoryloom/src/memoryloom/adapters/projection_outbox.py) 与 [src/memoryloom/application/projection.py](D:/Code/memoryloom/src/memoryloom/application/projection.py)。

`MemoryProjectionWorker.run_once` 先 discover，再 claim 一批带租约的任务。成功 upsert 后 complete；失败按尝试次数指数退避，达到上限进入死信。默认租约 60 秒，最大尝试 8 次，退避上限 300 秒；这些是代码默认值，不是本机已开启服务的证明。

租约解决“哪个 Worker 暂时负责”，不保证网络请求绝不重复。若远端已成功但本地 complete 前崩溃，重试还会发生，所以投影写入必须可重复执行。

Milvus 返回 revision ID 及分数后，`recall` 仍围绕权威存储的可见快照评分，不能把向量命中直接当成可读正文。测试 `test_hybrid_recall_revalidates_vector_candidates_against_authority` 位于 [tests/test_projection.py](D:/Code/memoryloom/tests/test_projection.py)。默认 hash embedding 用于离线确定性流程，不等于真实语义 embedding 的召回质量。

注意：`rebuild()` 会 reset 投影并重新排队，不是无副作用的健康检查；首次学习不执行它。

## 演化改变有限策略，不改变安全边界

[src/memoryloom/domain/evolution.py](D:/Code/memoryloom/src/memoryloom/domain/evolution.py) 对单项权重设定 `[0.05,0.60]` 区间且总和为 1；实验必须沿允许的状态迁移：

```text
proposed → offline_passed → shadow → canary → promoted
```

不同阶段存在拒绝或回滚分支。`EvolutionApplication.advance` 核对签名门禁回执、过期时间和目标迁移，再交给存储原子保存实验变化与激活信息。普通策略注册不能直接激活候选。

shadow/canary 状态机存在，不表示本次已经部署了真实线上流量分配。读 [src/memoryloom/application/evolution.py](D:/Code/memoryloom/src/memoryloom/application/evolution.py) 与 [tests/test_evolution_application.py](D:/Code/memoryloom/tests/test_evolution_application.py)，重点看跳阶段被拒绝、竞争晋升不留下半份审计、回滚恢复基线。

练习：画出“新偏好已写入但投影暂不可用”的时序，指出数据完整性、召回质量、ready 状态分别可能怎样变化。然后解释为何调大 semantic 权重不能绕过 Scope 校验。回答不出时，回到权限包装与权威快照，而不是继续增加向量库术语。
