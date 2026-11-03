-- 创建只读用户，用于 Claude Code 数据库 MCP Server
-- 书中位置：ch16 16.4

CREATE USER claude_readonly WITH PASSWORD 'your-readonly-password';
GRANT CONNECT ON DATABASE mydb TO claude_readonly;
GRANT USAGE ON SCHEMA public TO claude_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_readonly;
