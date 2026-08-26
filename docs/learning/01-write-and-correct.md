# 用户改口以后，旧记忆去了哪里？

假设 Alice 说“晚上只喝低因咖啡”，后来又说“晚上改喝温水”。这是教学输入，不是本次真实用户数据。系统需要保留两次话语，同时知道现在应该采用哪个偏好。直接更新一行 value 会丢失“为什么改、什么时候改、当时知道什么”。

## 第一次写入：一句话拆成四种对象

API 输入可以参照真实测试 [tests/test_api.py](D:/Code/memoryloom/tests/test_api.py) 的 `test_http_vertical_slice`：

```json
{
  "tenant_id":"tenant-a", "subject_id":"alice",
  "source":"conversation", "idempotency_key":"api-turn-1",
  "key":"drink.preference", "value":"decaf coffee",
  "context":{"time_of_day":"evening"},
  "evidence_text":"晚上我只喝低因咖啡", "confidence":0.92
}
```

从 `POST /v1/preferences` 开始，[src/memoryloom/api/app.py](D:/Code/memoryloom/src/memoryloom/api/app.py) 先处理请求与身份，再调用授权包装层，最后进入 [src/memoryloom/application/service.py](D:/Code/memoryloom/src/memoryloom/application/service.py) 的 `remember_preference`。不要跳过 [src/memoryloom/application/access.py](D:/Code/memoryloom/src/memoryloom/application/access.py)：能构造命令不代表有权限执行命令。

| 中间对象 | 本例里记录什么 | 为什么不能合并 |
| --- | --- | --- |
| Observation | 原话、来源、发生时间、摄入时间、幂等键 | 它记录看到了什么，不宣称结论必然正确 |
| EvidenceSpan | 指向 Observation 的引用和支持立场 | 说明哪段输入支撑后续结论 |
| Candidate | `drink.preference=decaf coffee`、晚间情境、置信度 | 它是结构化候选，不是自由生成的一段回答 |
| MemoryRecord / MemoryRevision | 稳定记忆身份与本次不可变信念版本 | 同一个问题会有新结论，但历史引用不能跟着变化 |

`remember_preference` 在 `store.transaction()` 内先检查幂等，再保存摄入事实，随后 `_accept_candidate` 形成修订。UUID 和时间由注入的接口提供；测试能使用固定时钟和顺序 ID，因此不是每次都靠睡眠等待来验证时间。

这里的固定部分是对象结构、校验、事务流程；运行时变化的是用户、情境、原话、时间和结果 ID。模型并未在这条写入函数里自主决定字段含义。

## 同一个请求重发，和同一句话再次出现，不是一回事

网络超时后，客户端不确定写入有没有成功。如果用原幂等键、原内容重发，服务应返回原结果，不再增加一份证据。如果复用同一键却把 value 改成 water，应拒绝冲突；否则“防重复”会掩盖真实的新输入。

但用户在另一时刻再次确认偏好，是新的证据事件，可以使用新的幂等键。是否强化信念、是否形成修订，要看 `_accept_candidate` 的规则。这也解释了为什么“新请求 ID”不能随意等同“新事实”。

阅读 [tests/test_memory_application.py](D:/Code/memoryloom/tests/test_memory_application.py) 中 `test_preference_ingestion_is_idempotent`、`test_idempotency_key_cannot_hide_different_input`、`test_repeated_evidence_appends_revision_and_strengthens_belief`。先写下三种情况应该产生几份事件，再看断言。

## 修正：稳定记录不变，修订向前走

`correct_preference` 先按 Scope 与 record ID 找当前快照，再检查重复请求以及 `expected_revision_id`。如果页面仍拿着旧版本，服务拒绝覆盖更新后的结果：调用方必须以自己实际见过的版本为前提，避免把别人的较新修改悄悄覆盖。这就是乐观并发控制。

教学状态如下，ID 用 r1/r2 简写，实际接口为 UUID：

| 时点 | 记录身份 | 当前修订 | 历史 |
| --- | --- | --- | --- |
| 首次写入 | record-A | r1：低因咖啡 | r1 |
| 明确修正后 | record-A | r2：温水 | r1、r2 |
| 用旧 expected revision 再修正 | record-A | 仍是 r2 | 请求冲突，不偷偷覆盖 |

幂等重放检查在并发前提检查之前，所以成功过的相同修正请求重试，不应因为当前版本已经前进就误报过期。对应 `test_correction_rejects_a_stale_expected_revision_but_allows_its_retry`。

## 你应该亲手验证什么

用同一个输入提交两次，再改 value 但保留幂等键。记录返回的 record/revision ID、是否重放以及错误类型。然后通过修正接口追加版本，读取历史确认两条都在。完整操作入口见下一篇启动练习，而不是直接操作数据库表。

完成标志：不看代码也能解释“证据、记录、修订、当前快照”四者关系。自测：如果把用户 Alice 改成 Bob，只保留相同幂等键，系统应在哪个作用域判断重复？去 `Scope` 与测试的隔离断言核对。
