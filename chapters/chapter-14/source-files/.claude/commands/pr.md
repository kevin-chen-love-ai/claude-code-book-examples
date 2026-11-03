# /pr

## 说明

从当前分支的 git 历史生成 PR 描述草稿。

## 步骤

1. 运行 `git log main..HEAD --oneline`，读取当前分支相对 main 的所有提交
2. 按类型分组：新功能、Bug 修复、重构、文档
3. 生成 PR 描述，包含：改动摘要、详细列表、测试覆盖说明
4. 输出 Markdown 格式的 PR 描述

如果存在 `.github/pull_request_template.md`，按模板格式生成。
