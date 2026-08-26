# 理解之后，再回答这些追问

回答时按“要解决的问题 → 当前机制 → 证据 → 边界”组织。以下是项目机制，不是你的个人贡献声明。

| 问题 | 参考回答与组织思路 | 继续追问时的边界 |
| --- | --- | --- |
| 为什么不只存文本和向量？ | 先区分原始输入、信念、召回、使用结果；向量只处理找候选的一部分 | 向量相似不能证明授权、时效或真实性 |
| 写入是不是模型自动提取？ | 当前 preference 链路接收结构化 key/value 等字段，然后建证据和修订 | 不应说任意聊天都能自动变成高质量记忆 |
| 读取为何不强化信念？ | 读取是系统行为，不是独立新证据，否则形成反馈循环 | Trace 会追加，不能说完全不写数据库 |
| belief 与 utility 区别？ | 前者描述对偏好结论的信念，后者描述特定情境下的结果帮助度 | helpful 不自动变成新事实证据 |
| 同一偏好如何修正？ | 稳定 record 下追加 revision，并核对 expected revision | 旧版本保留不代表每个时间查询都返回旧版 |
| 幂等是否等于缓存？ | 幂等用 Scope、键和内容核对同一业务请求；缓存为复用计算结果 | 同键不同内容要冲突，不是直接返回旧响应就结束 |
| 双时间解决什么？ | 将业务何时生效和系统何时知道分开，处理迟到修正 | 当前策略下的历史状态投影不等于完整历史重放 |
| 没有向量库能不能召回？ | 可以走权威存储与词法/情境评分，投影可选 | 离线 hash embedding 不能代表真实语义效果 |
| 压缩会不会编造新内容？ | 当前确定性抽取与精确去重不做 LLM 改写，保留来源关系 | 预算按字符；省略内容可能损失召回覆盖 |
| Outcome 为什么需要 Trace？ | 固定实际候选集合，拒绝给没召回的 revision 归因 | 底层 API 的 usage 可选；严格消费闭环需传 usage |
| PostgreSQL 与 Milvus 如何一致？ | 权威事务写 outbox，Worker 异步更新投影，读取再核权威可见性 | 有最终一致窗口，不是跨库强事务 |
| 演化到底改什么？ | 有界检索权重等策略，经实验与门禁晋升 | 不微调模型，不自动改权限、删除或隔离规则 |
| 服务重启为何丢数据？ | 原生默认 memory adapter；持久化需要 PostgreSQL 配置 | 运行模式必须看实际状态，不能只看仓库有数据库适配器 |
| 权限在什么地方执行？ | API 解析可信身份，应用授权包装执行 action/Scope/purpose 检查 | 直接调用底层应用对象的测试不等于生产授权链已验证 |

代码依据按主题阅读：[src/memoryloom/application/service.py](D:/Code/memoryloom/src/memoryloom/application/service.py)、[src/memoryloom/application/access.py](D:/Code/memoryloom/src/memoryloom/application/access.py)、[src/memoryloom/application/compression.py](D:/Code/memoryloom/src/memoryloom/application/compression.py)、[src/memoryloom/application/projection.py](D:/Code/memoryloom/src/memoryloom/application/projection.py)、[src/memoryloom/application/evolution.py](D:/Code/memoryloom/src/memoryloom/application/evolution.py)。

口头练习：拿“晚上改喝温水”解释 90 秒，再追问“修正晚到五天怎么办”“向量仍返回咖啡怎么办”“用户给反馈但没实际采用该记忆怎么办”。能沿同一个例子回答，比背完五个 plane 的英文名更有用。
