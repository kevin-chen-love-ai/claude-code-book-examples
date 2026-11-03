#!/bin/bash
# protect-sensitive-files.sh — 防止误改敏感文件
# 书中位置：ch15 15.3

# Hook 输入是一段 JSON，从 stdin 读入；文件路径在 .tool_input.file_path
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 敏感文件模式列表
SENSITIVE_PATTERNS=(
  ".env"
  ".env.*"
  "*.pem"
  "*.key"
  "id_rsa"
  "id_edsa"
  "docker-compose.prod.yml"
  "terraform.tfstate"
  "*.tfstate"
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  if [[ "$(basename "$FILE_PATH")" == $pattern ]]; then
    echo "WARNING: Attempting to modify sensitive file: $FILE_PATH"
    echo "If this is intentional, confirm with the user before proceeding."
    exit 1
  fi
done

exit 0
