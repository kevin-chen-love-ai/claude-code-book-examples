# 《Claude Code实战:从Vibe Coding入门到智能体工程》随书源码

本目录只包含从原始 `examples/` 目录复制、整理得到的读者代码。原书稿和原示例文件没有修改。

## 用途声明

本仓库中的代码均为《Claude Code实战:从Vibe Coding入门到智能体工程》的配套演示代码，仅用于书本讲解、学习和实验。仓库内容与任何公司的生产代码、生产系统及实际业务无关，不应直接用于生产环境。

## 使用方式

- 每章对应 `chapters/chapter-XX/`。
- `source-files/` 保存原 `examples/` 中与该章有关的文件，并尽量保留原目录结构。
- 第 18—21 章的 `project/` 是完整项目快照。
- `manifest.json` 只记录发布文件的章节、类型和相对路径，不包含原始来源路径或文件哈希。

## 章节索引

| 目录 | 对应章节 | 内容 |
|---|---|---|
| [chapter-01](chapters/chapter-01/) | 第 1 章 初识 Claude Code：5 分钟跑通对话式编程 | 配套源文件 |
| [chapter-02](chapters/chapter-02/) | 第 2 章 需求表达的艺术：怎样让 Claude Code 准确理解意图 | 配套源文件 |
| [chapter-03](chapters/chapter-03/) | 第 3 章 Superpowers：为 Claude Code 装上专家级工作流 | 配套源文件 |
| [chapter-04](chapters/chapter-04/) | 第 4 章 掌控会话：理解执行流与精准导航 | 配套源文件 |
| [chapter-05](chapters/chapter-05/) | 第 5 章 走出官方限制：用 CC Switch 自由切换模型 | 配套源文件 |
| [chapter-06](chapters/chapter-06/) | 第 6 章 上下文管理：决定能走多远的关键技能 | 配套源文件 |
| [chapter-07](chapters/chapter-07/) | 第 7 章 CLAUDE.md：为项目建立持久的长期记忆 | 配套源文件 |
| [chapter-08](chapters/chapter-08/) | 第 8 章 调试与纠偏：当 Claude Code 走错路时怎么办 | 配套源文件 |
| [chapter-09](chapters/chapter-09/) | 第 9 章 与 Git 协作：把版本控制变成开发安全网 | 配套源文件 |
| [chapter-10](chapters/chapter-10/) | 第 10 章 大任务拆解：复杂需求的分解策略 | 配套源文件 |
| [chapter-11](chapters/chapter-11/) | 第 11 章 OpenSpec：规格驱动开发 | 无独立配套源码 |
| [chapter-12](chapters/chapter-12/) | 第 12 章 重构：Claude Code 最被低估的能力 | 配套源文件 |
| [chapter-13](chapters/chapter-13/) | 第 13 章 测试：用 Claude Code 写出真正有效的测试 | 配套源文件 |
| [chapter-14](chapters/chapter-14/) | 第 14 章 文档与注释：让写文档成为开发的副产品 | 配套源文件 |
| [chapter-15](chapters/chapter-15/) | 第 15 章 自动化：用自定义命令与 Hooks 把重复变成机制 | 配套源文件 |
| [chapter-16](chapters/chapter-16/) | 第 16 章 MCP：让 Claude Code 连上整个工作世界 | 配套源文件 |
| [chapter-17](chapters/chapter-17/) | 第 17 章 Skills 与子 Agent：搭建一支 AI 工程小队 | 配套源文件 |
| [chapter-18](chapters/chapter-18/) | 第 18 章 实战一：开发一个 Python CLI 工具 | 完整项目：`autocover-cli` |
| [chapter-19](chapters/chapter-19/) | 第 19 章 实战二：开发一个 iOS App | 完整项目：`livesnap` |
| [chapter-20](chapters/chapter-20/) | 第 20 章 实战三：开发一个 Web 应用 | 完整项目：`clearmark` |
| [chapter-21](chapters/chapter-21/) | 第 21 章 实战四：发布一个开源项目 | 完整项目：`autosocialx` |
| [chapter-22](chapters/chapter-22/) | 第 22 章 实战五：用 Claude Code 处理日常工作 | 无独立配套源码 |

## 敏感信息

API Key、私钥、数据库口令、云平台用户名、个人邮箱、个人 Bundle ID 和本机绝对路径均应使用占位符或环境变量。仓库不会提供真实凭证。

常用占位符包括：

```text
your-api-key-here
your-db-password
your-project-ref
your-username
reader@example.com
com.example.livesnap
```

## 验证

```bash
python3 scripts/verify_package.py
```

项目级构建命令见各章 README。
