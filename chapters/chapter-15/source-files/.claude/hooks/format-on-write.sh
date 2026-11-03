#!/bin/bash
# format-on-write.sh — Claude Code 写入文件后自动格式化
# 书中位置：ch15 15.2

# Hook 输入是一段 JSON，从 stdin 读入；文件路径在 .tool_input.file_path
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  echo "No file path provided"
  exit 0
fi

# 只处理 Java 代码文件
case "$FILE_PATH" in
  *.java)
    # 用 Maven 包装器跑 spotless；若项目没配 spotless 插件则静默跳过，
    # 不把 Maven 报错泄漏给 Claude Code（stdout、stderr 都丢弃）。
    if [ -x "./mvnw" ]; then
      ./mvnw spotless:apply -q >/dev/null 2>&1 || true
    fi
    ;;
esac

exit 0
