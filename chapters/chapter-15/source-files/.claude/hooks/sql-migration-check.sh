#!/bin/bash
# sql-migration-check.sh — 新增数据库迁移脚本后做基本检查
# 书中位置：ch15 15.5.4（用 handler 级 if 仅匹配 db/migration/*.sql）
# 书中未展示脚本内容；此处为可运行占位。

# Hook 输入是一段 JSON，从 stdin 读入；文件路径在 .tool_input.file_path
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')
# 示例：检查迁移文件命名与是否含 down 脚本
exit 0
