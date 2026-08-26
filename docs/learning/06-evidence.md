# 源码依据与验证范围

## 2026-11-02：本次文档更新

- 仓库基线：本仓库当前主分支。
- 已核对 [README](../../README.md)、[示例脚本](../../examples/first_memory.py)、[API 入口](../../src/memoryloom/api/app.py)、[应用服务](../../src/memoryloom/application/service.py)、[领域对象](../../src/memoryloom/domain/) 与现有 `docs/learning/` 内容。
- 短暂启动了本机内存模式后端并运行 `examples/first_memory.py`。示例完整结束：写入后当前偏好数为 1；晚间问题召回首项为 `decaf coffee`；一次 `helpful` 反馈后的上下文效用均值为 `0.667`；修正后的序号为 2，历史值为 `['decaf coffee', 'herbal tea']`。
- 示例产生的 `record_id`、`revision_id` 与 `trace_id` 是每次运行生成的标识，不把本次值当作固定预期。运行后已停止后端；默认内存数据不持久化。
- 本次未重跑测试套件，未启动 PostgreSQL、Milvus、Docker、浏览器 E2E，也未测试真实模型接入或生产部署。示例跑通证明本机这一条开发流程可用，不代表完整 CI 或真实业务质量。

## 2026-10-29：原学习资料的历史核对

原资料记录：`uv sync --frozen` 建立 Python 3.12.14 项目环境；五个针对性测试文件通过，**78 passed in 20.69s**，使用 `--no-cov -p no:cacheprovider`。该结果属于当时的核对，不是本次执行，也不是全套覆盖率验收。复现命令见 [启动与练习](04-run-and-practice.md)。

测试范围包括 [tests/test_memory_application.py](../../tests/test_memory_application.py)、[tests/test_compression.py](../../tests/test_compression.py)、[tests/test_evolution_application.py](../../tests/test_evolution_application.py)、[tests/test_projection.py](../../tests/test_projection.py) 与 [tests/test_authorization.py](../../tests/test_authorization.py)。向量适配器的替身测试不是在线 Milvus 服务测试。

## 阅读这些教程时如何判断结论

- **实测**：必须标明运行日期、命令和观察到的结果。本次只对示例的内存闭环作此声明。
- **源码支持**：例如 PostgreSQL outbox、Milvus 投影、双时间查询和演化状态机，应沿对应代码与测试核对；本次没有把它们当作正在运行的服务。
- **教学输入**：文中的 r1/r2、Alice 改喝温水和手算分数是用于推理的简化例子，不是采集的运行日志。
- **尚未证明**：真实用户的记忆提取质量、在线语义检索质量、生产环境可靠性与端到端答案质量。README 将项目标为 `0.1.0` 开发预览版。

文档改动仅在本地 `docs/learning/`；未修改业务源码、依赖或部署配置，也未提交或推送。
