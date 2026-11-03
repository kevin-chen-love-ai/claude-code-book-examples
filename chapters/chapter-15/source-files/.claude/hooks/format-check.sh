#!/bin/bash
# format-check.sh — 写入文件后做格式检查
# 书中位置：ch15 15.5.4（settings.json 中按 matcher=Write 注册）
# 书中未展示脚本内容；此处为可运行占位（默认放行）。

# Hook 输入是一段 JSON，从 stdin 读入；文件路径在 .tool_input.file_path
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')
# 示例：对 Java 文件运行格式检查，可替换为 ./mvnw spotless:check 等
exit 0
