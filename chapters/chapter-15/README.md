# 第 15 章 自动化：用自定义命令与 Hooks 把重复变成机制

## 配套文件

- `source-files/.claude/hooks/api-doc-sync-reminder.sh`
- `source-files/.claude/hooks/auto-test-on-change.sh`
- `source-files/.claude/hooks/debug-hook.sh`
- `source-files/.claude/hooks/format-check.sh`
- `source-files/.claude/hooks/format-on-write.sh`
- `source-files/.claude/hooks/graceful-error-handling.sh`
- `source-files/.claude/hooks/protect-sensitive-files.sh`
- `source-files/.claude/hooks/session-start-context.sh`
- `source-files/.claude/hooks/sql-migration-check.sh`
- `source-files/.claude/settings.json`
- `source-files/.gitignore`
- `source-files/.mvn/wrapper/maven-wrapper.properties`
- `source-files/mvnw`
- `source-files/mvnw.cmd`
- `source-files/pom.xml`

## 示例验证

```bash
cd source-files
./mvnw test
```
