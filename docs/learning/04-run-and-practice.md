# 先跑内存闭环，再理解数据库与向量投影

本机已为本项目建立 `.venv`，使用 Python 3.12.14。以下均在 **VS Code 的 Windows PowerShell 终端** 执行，工作目录为 `D:\Code\MemoryLoom`；不需要 WSL。项目会优先使用自己的虚拟环境，避免把全局 Python 误认为项目运行版本。

## 第一轮：不需要模型 Key 的内存模式

```powershell
Set-Location D:\Code\MemoryLoom
uv run python -c "import sys; print(sys.executable); print(sys.version)"
uv run memoryloom
```

第二个终端启动工作台：

```powershell
Set-Location D:\Code\MemoryLoom
uv run memoryloom-frontend
```

打开 `http://127.0.0.1:33009`；API 文档位于 `http://127.0.0.1:38089/docs`。原生默认是内存存储，但环境变量可以改变配置；先查 `/health` 返回的实际 store/projection/auth 状态，再运行 [examples/first_memory.py](D:/Code/memoryloom/examples/first_memory.py)：

```powershell
Invoke-RestMethod http://127.0.0.1:38089/health
uv run python examples/first_memory.py
```

示例会写入本地 demo/alice 数据。运行时应核对创建 ID、召回命中、反馈与修正历史，不要只看到 HTTP 200 就认为闭环完成。2026-11-02 已在本机实际运行该示例，观察到 1 条当前偏好、首条召回为 `decaf coffee`、一次 helpful 后效用均值 `0.667`、修正后历史为 `['decaf coffee', 'herbal tea']`。服务随后已停止；默认内存模式下，本次示例数据也随之消失。

若 `uv run` 报 `failed to create directory ... uv\\cache`，先运行 `uv cache dir` 查看路径。本机曾因默认缓存路径经过 Windows 目录连接而失败，已设置用户级 `UV_CACHE_DIR` 指向真实目录；**完全退出并重开 VS Code** 后新终端才能继承该设置。不要把 `--no-cache --no-sync` 当作项目常规启动参数。

## 三个小实验

| 实验 | 操作 | 应观察的结果 |
| --- | --- | --- |
| 重发写入 | 同一 Scope、幂等键和内容请求两次 | 原结果重放，不额外增加证据 |
| 连续读取 | 对同一偏好召回三次，不反馈 | Trace 可以增加，belief 与 utility 不因读取增加 |
| 版本冲突 | 修正成功后，再用旧 expected revision 发另一个修正 | 拒绝旧前提，不覆盖新版本；相同成功请求重放例外 |

优先在现有测试中改教学输入，另建练习副本，不修改上游业务代码。若要做第一个功能改动，可以新增一条测试覆盖你设计的情境组合，而不是立刻新增“自动记忆提取”。

## 按症状排障

| 现象 | 最小检查 | 如何判断下一步 |
| --- | --- | --- |
| 包导入失败 | 上面的 sys.executable 命令 | 指向全局 Python 就先解决环境，不改代码 |
| 页面能开、API 失败 | `/health` 与浏览器请求地址 | 分开检查前端进程、API 进程及公开 API URL |
| 重启数据消失 | `/health` 的 storage | memory 属正常行为；持久化另用 PostgreSQL |
| 写入后零召回 | Scope、查询相关性、context、时间与阈值 | 写入成功不保证任何问题都能匹配 |
| 409 | 对比幂等键、请求内容、expected revision | 分清重复请求冲突和并发版本冲突 |
| 403/404 | 身份、purpose、Scope、处理依据 | 不能通过改请求体中的用户 ID 绕过授权 |
| ready 失败 | store、projection_required 与依赖 | 健康与就绪含义不同；查具体依赖再重启 |

配置入口：[src/memoryloom/config.py](D:/Code/memoryloom/src/memoryloom/config.py)；HTTP 错误映射：[src/memoryloom/api/app.py](D:/Code/memoryloom/src/memoryloom/api/app.py)；上游排障：[docs/troubleshooting.md](D:/Code/memoryloom/docs/troubleshooting.md)。

## 针对性测试命令

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_memory_application.py tests/test_compression.py tests/test_evolution_application.py tests/test_projection.py tests/test_authorization.py -q --no-cov -p no:cacheprovider
```

该命令在 2026-10-29 的先前核对中得到 78 项通过；**2026-11-02 更新文档时未重跑这些测试**，所以不能把它写成本次全套覆盖率验收。PostgreSQL 测试会清理专用测试库，不能随意传开发数据库 URL；其双重防护见 [tests/conftest.py](D:/Code/memoryloom/tests/conftest.py)。第一轮无需执行数据库测试或启动完整 Compose。
