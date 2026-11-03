# AutoSocialX Webhook API 接口文档

## 基本信息

| 项目 | 值 |
|------|-----|
| 接口地址（生产） | `POST http://<your-server>:5678/webhook/social-publish` |
| 接口地址（测试） | `POST http://<your-server>:5678/webhook-test/social-publish` |
| Content-Type | `application/json` |
| 认证方式 | 无（内网部署，建议配合 Nginx 做 IP 白名单或 Token 头） |

---

## 请求参数

### Body（JSON）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `platform` | `string` | ✅ 必填 | 目标发布平台，见下方枚举 |
| `text` | `string` | ✅ 必填 | 发布的文字内容 |
| `media_urls` | `string[]` | ⬜ 选填 | 图片/视频 URL 数组，支持多张图片 |
| `board_id` | `string` | Pinterest 必填 | Pinterest 图板 ID |
| `channel` | `string` | Slack 必填 | Slack 频道名，如 `#general` |

> **`media_urls` 说明：**
> - 即使只有一张图片，也需要写成数组格式：`["https://..."]`
> - Instagram、Pinterest 至少需提供一张图片
> - 如不发图片，可省略此字段或传空数组 `[]`

---

## platform 枚举值

| 枚举值 | 平台 | 图片上限 | 备注 |
|--------|------|---------|------|
| `twitter` | Twitter / X | 4 张 | 视频只能 1 个 |
| `linkedin` | LinkedIn | 9 张 | 须以图文混排格式上传 |
| `facebook` | Facebook 主页 | 不限（建议≤10） | 需 Page Access Token |
| `instagram` | Instagram | 10 张 | 多图为 Carousel；需关联 Facebook 主页 |
| `pinterest` | Pinterest | 1 张 | 每个 Pin 只有一张图，取 `media_urls[0]` |
| `discord` | Discord | 10 张 | 通过 Webhook 发送 |
| `slack` | Slack | 不限 | 需 Bot Token + `chat:write` 权限 |

---

## 请求示例

### 仅文字

```bash
curl -X POST http://localhost:5678/webhook/social-publish \
     -H "Content-Type: application/json" \
     -d '{
       "platform": "twitter",
       "text": "Hello World！这是一条自动发布的推文。"
     }'
```

### 图文（多张图片）

```bash
curl -X POST http://localhost:5678/webhook/social-publish \
     -H "Content-Type: application/json" \
     -d '{
       "platform": "instagram",
       "text": "今日美景 📸",
       "media_urls": [
         "https://example.com/photo1.jpg",
         "https://example.com/photo2.jpg",
         "https://example.com/photo3.jpg"
       ]
     }'
```

### Pinterest（需 board_id）

```bash
curl -X POST http://localhost:5678/webhook/social-publish \
     -H "Content-Type: application/json" \
     -d '{
       "platform": "pinterest",
       "text": "旅行攻略 🗺️",
       "board_id": "123456789",
       "media_urls": ["https://example.com/cover.jpg"]
     }'
```

### Slack（需指定频道）

```bash
curl -X POST http://localhost:5678/webhook/social-publish \
     -H "Content-Type: application/json" \
     -d '{
       "platform": "slack",
       "text": "每日报告已生成 ✅",
       "channel": "#general",
       "media_urls": ["https://example.com/chart.png"]
     }'
```

---

## 响应说明

### 成功（HTTP 200）

```json
{
  "status": "published",
  "platform": "twitter",
  "timestamp": "2024-03-14T10:00:00.000Z"
}
```

### 失败 - Webhook 未注册（HTTP 404）

```json
{
  "code": 404,
  "message": "The requested webhook \"POST social-publish\" is not registered.",
  "hint": "The workflow must be active for a production URL to run successfully."
}
```

> **解决方法：** 打开 n8n 界面 → 进入工作流 → 点击右上角 **Publish** 按钮

### 失败 - 平台 API 错误

节点执行失败时，n8n 会返回 HTTP 500，响应体中包含 Platform API 返回的具体错误信息（如凭据无效、权限不足等）。可在 n8n 的 **Executions** 日志中查看完整错误堆栈。

---

## 测试模式 vs 生产模式

| | 测试模式 | 生产模式 |
|--|---------|---------|
| **URL 路径** | `/webhook-test/social-publish` | `/webhook/social-publish` |
| **触发方式** | 需在 n8n 界面点击 "Execute workflow" | 工作流 Publish 后持续监听 |
| **可视化效果** | ✅ 有，画布会显示数据流动轨迹 | ❌ 无（静默执行） |
| **查看结果** | 即时在画布节点上看到 | 在左侧 Executions 日志中查看 |
| **用途** | 开发调试、验证路由、测试参数 | 生产环境、AI Agent 集成 |

---

## Python 调用示例

```python
import requests

def publish_to_social(platform: str, text: str, media_urls: list[str] = None, **kwargs):
    url = "http://localhost:5678/webhook/social-publish"
    payload = {
        "platform": platform,
        "text": text,
        "media_urls": media_urls or [],
        **kwargs
    }
    response = requests.post(url, json=payload, timeout=30)
    response.raise_for_status()
    return response.json()

# 示例调用
publish_to_social(
    platform="twitter",
    text="AI 自动发布测试！",
    media_urls=["https://example.com/image.png"]
)

# LinkedIn 图文
publish_to_social(
    platform="linkedin",
    text="行业洞察分享",
    media_urls=["https://example.com/infographic.jpg"]
)

# Slack 通知
publish_to_social(
    platform="slack",
    text="新版本发布通知 🎉",
    channel="#dev-releases"
)
```
