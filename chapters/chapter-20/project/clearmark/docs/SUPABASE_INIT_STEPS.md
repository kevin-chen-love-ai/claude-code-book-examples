# Supabase 数据库初始化步骤

## 已配置的连接信息

✅ **Project URL**: https://your-project-ref.supabase.co  
✅ **Anon Key**: 已配置到 `.env` 文件  
✅ **Service Key**: 已配置到 `.env` 文件  
✅ **USE_LOCAL_DB**: `false` (使用 Supabase)

## 初始化步骤

### 1. 登录 Supabase Dashboard

访问: https://app.supabase.com

选择项目: **your-project-ref**

### 2. 打开 SQL Editor

在左侧菜单中找到 **SQL Editor** 并点击

### 3. 执行数据库迁移脚本

点击 **New Query** 按钮

复制以下 SQL 脚本（或从 `backend/supabase-migrations.sql` 文件读取）并粘贴到编辑器中：

```sql
-- ClearMark Database Schema for Supabase
-- Run these migrations in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Posts table for blog management
CREATE TABLE IF NOT EXISTS posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    tags TEXT[] DEFAULT '{}',
    featured_image TEXT,
    author_id UUID REFERENCES auth.users(id) NOT NULL,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tasks table for watermark removal history
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    task_type TEXT NOT NULL, -- 'image' or 'video'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    original_file_url TEXT,
    processed_file_url TEXT,
    thumbnail_url TEXT,
    metadata JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Usage stats table
CREATE TABLE IF NOT EXISTS usage_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    date DATE NOT NULL,
    images_processed INTEGER DEFAULT 0,
    videos_processed INTEGER DEFAULT 0,
    storage_used BIGINT DEFAULT 0, -- in bytes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- RLS Policies for posts
CREATE POLICY "Anyone can view published posts"
    ON posts FOR SELECT
    USING (published = true OR auth.uid() = author_id);

CREATE POLICY "Users can create their own posts"
    ON posts FOR INSERT
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts"
    ON posts FOR UPDATE
    USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts"
    ON posts FOR DELETE
    USING (auth.uid() = author_id);

-- RLS Policies for tasks
CREATE POLICY "Users can view their own tasks"
    ON tasks FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create their own tasks"
    ON tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own tasks"
    ON tasks FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policies for usage_stats
CREATE POLICY "Users can view their own stats"
    ON usage_stats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats"
    ON usage_stats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
    ON usage_stats FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

点击 **Run** 按钮执行脚本

### 4. 验证初始化结果

执行完成后，检查：

1. **表结构**：
   - 进入 **Table Editor**
   - 应该能看到以下表：
     - `profiles`
     - `posts`
     - `tasks`
     - `usage_stats`

2. **RLS 策略**：
   - 进入 **Authentication** → **Policies**
   - 确认每个表都有相应的 RLS 策略

3. **触发器**：
   - 进入 **Database** → **Functions**
   - 应该能看到 `handle_new_user()` 和 `update_updated_at_column()` 函数

## 完成后验证

### 1. 测试数据库连接

```bash
# 启动服务
./scripts/start.sh docker

# 检查后端日志
docker compose logs backend | grep -i "database\|supabase"

# 测试健康检查
curl http://localhost:8000/api/health
```

### 2. 测试注册功能

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "your-test-password",
    "full_name": "Test User"
  }'
```

### 3. 检查 Supabase Dashboard

- 进入 **Authentication** → **Users**
- 应该能看到新注册的用户

## 下一步

初始化完成后，可以：

1. 配置 OAuth 登录（Google/Facebook）
2. 测试博客文章功能
3. 测试水印去除功能

## 注意事项

⚠️ **安全提示**：
- `.env` 文件包含敏感信息，**不要**提交到 Git
- Service Key 拥有完整权限，**不要**在前端代码中使用
- 定期轮换 API 密钥
