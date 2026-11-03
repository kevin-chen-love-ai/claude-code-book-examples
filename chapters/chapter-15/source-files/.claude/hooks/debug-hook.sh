#!/bin/bash
# debug-hook.sh — Hook 调试模板
# 书中位置：ch15 15.6

LOG_FILE="/tmp/claude-hook-$(basename "$0").log"

exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Hook triggered: $0"
# Hook 输入是 stdin 上的一段 JSON，先原样记录再解析
INPUT=$(cat)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Input JSON: $INPUT"
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] FILE_PATH: $FILE_PATH"

# 你的 Hook 逻辑在这里
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Hook completed with exit code $?"
exit 0
