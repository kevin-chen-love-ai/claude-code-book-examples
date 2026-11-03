#!/bin/bash
# session-start-context.sh — 会话开始时输出项目上下文
# 书中位置：ch15 15.5

echo "=== Project Context ==="

# 当前分支
if git rev-parse --git-dir > /dev/null 2>&1; then
  branch=$(git branch --show-current 2>/dev/null)
  echo "Branch: $branch"

  # 未提交的更改数量
  unstaged=$(git diff --name-only | wc -l | tr -d ' ')
  staged=$(git diff --cached --name-only | wc -l | tr -d ' ')
  if [ "$unstaged" -gt 0 ] || [ "$staged" -gt 0 ]; then
    echo "Uncommitted changes: $unstaged unstaged, $staged staged"
  else
    echo "Working directory clean"
  fi

  # 最近 3 条提交
  echo "Recent commits:"
  git log --oneline -3 --no-decorate 2>/dev/null | sed 's/^/  /'
fi

# Java 项目信息
if [ -f "pom.xml" ]; then
  project_name=$(grep -m1 "<artifactId>" pom.xml | sed 's/.*<artifactId>\([^<]*\)<\/artifactId>.*/\1/' 2>/dev/null)
  echo "Project: $project_name"
fi

echo "======================="
exit 0
