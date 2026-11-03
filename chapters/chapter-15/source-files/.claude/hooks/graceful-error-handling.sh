#!/bin/bash
# graceful-error-handling.sh — Hook 脚本错误处理模板
# 书中位置：ch15 15.7

# 不要 set -e，Hook 脚本的错误不应中断 Claude Code
# set -e

log_file="/tmp/claude-hooks.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$log_file"
}

# Hook 输入从 stdin 读入（只能读一次，先存下来）
INPUT=$(cat)

# 主逻辑
main() {
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

  if [ -z "$FILE_PATH" ]; then
    log "No file path provided, skipping"
    exit 0
  fi

  # 示例：尝试运行某个检查命令
  if ! some_command "$FILE_PATH" 2>> "$log_file"; then
    log "Warning: some_command failed for $FILE_PATH"
    # 输出警告但不中断流程
    echo "Warning: Check failed for $FILE_PATH (see $log_file)"
  fi
}

main
exit 0
