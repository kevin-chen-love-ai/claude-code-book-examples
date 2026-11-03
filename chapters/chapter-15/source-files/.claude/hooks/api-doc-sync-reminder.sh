#!/bin/bash
# api-doc-sync-reminder.sh — 改动 Controller 后提醒同步 API 文档
# 书中位置：ch15 15.5.4
# 配置层用 "if": "Write(*Controller.java)" 收窄触发范围；
# 脚本内再用 case 兜底，两层都做更稳（见 15.5.4）。

# Hook 输入是一段 JSON，从 stdin 读入；文件路径在 .tool_input.file_path
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')

# 兜底过滤：只对 *Controller.java 提醒，其他文件静默放行
case "$FILE_PATH" in
  *Controller.java)
    echo "提醒：$FILE_PATH 已改动，请检查 API 文档是否需要同步更新。"
    ;;
esac
exit 0
