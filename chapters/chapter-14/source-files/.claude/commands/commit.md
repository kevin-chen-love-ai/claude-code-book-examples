# /commit

## 说明

分析当前 git diff，生成符合 Conventional Commits 规范的提交信息。

## 步骤

1. 运行 `git diff --cached`（或 `git diff HEAD`），读取待提交的改动
2. 分析改动类型：feat（新功能）、fix（修复）、refactor（重构）、docs（文档）、chore（维护）
3. 生成提交信息，格式：`type(scope): 简短描述`
4. 输出建议的 message，等待确认后再执行 `git commit`

不要自动执行 git commit，只生成 message。
