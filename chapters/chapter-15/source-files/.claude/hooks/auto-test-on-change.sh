#!/bin/bash
# auto-test-on-change.sh — 根据改动文件跑相关测试
# 书中位置：ch15 15.4

# Hook 输入是一段 JSON，从 stdin 读入；文件路径在 .tool_input.file_path
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 从文件路径推断测试类名
# 例如：src/main/java/com/example/orders/OrderService.java → OrderServiceTest
case "$FILE_PATH" in
  *.java)
    filename=$(basename "$FILE_PATH" | sed 's/\.java$//')
    test_class="${filename}Test"
    if [ -f "pom.xml" ]; then
      test_cmd="./mvnw test -Dtest=$test_class -q"
      echo "Running: $test_cmd"
      eval $test_cmd
      exit_code=$?
      if [ $exit_code -ne 0 ]; then
        echo "Tests failed for $FILE_PATH"
        exit $exit_code
      fi
    fi
    ;;
esac

exit 0
