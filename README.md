# ChatKefu - 客服对话系统

基于 Telegram Bot 的网页客服系统，支持**群组话题模式**。

## 功能

- 🌐 网页客服对话界面
- 💬 支持文字、图片、视频消息
- 🤖 Telegram Bot 双向通信
- 💬 **支持 Telegram 群组话题模式（Topics）**
- ⏱️ 会话自动保存 7 天
- 🔑 关键词自动回复
- 🐳 Docker Compose 一键部署

## 快速开始

### 基础部署（私聊模式）

```bash
# 1. 克隆项目
git clone https://github.com/pkhosn/chatkefu.git
cd chatkefu

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 Telegram Bot Token

# 3. 启动服务
docker compose up -d

# 4. 访问 http://your-vps-ip:3000
```

### 群组话题模式部署

1. **获取群组 ID**：
   - 将 Bot 添加到群组
   - 在群组中发送一条消息
   - 转发该消息给 @userinfobot 获取群组 ID
   - 或使用 URL：`https://t.me/c/xxxxxxxxxx` 中的数字

2. **获取话题 ID**：
   - 在群组中开启话题模式
   - 进入特定话题
   - 话题 ID 即 URL 中的数字：`https://t.me/c/xxxxxxxxxx/topicId`
   - 或通过 Bot 日志查看 `message_thread_id`

3. **配置环境变量**：
```env
TG_BOT_TOKEN=your_bot_token
TG_GROUP_ID=-1001234567890  # 你的群组 ID
TG_TOPIC_ID=123             # 你的话题 ID（可选）
```

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `TG_BOT_TOKEN` | Telegram Bot Token | ✅ |
| `TG_GROUP_ID` | 群组 ID（话题模式） | ❌ |
| `TG_TOPIC_ID` | 话题 ID | ❌ |
| `PORT` | 服务端口（默认 3000） | ❌ |
| `SESSION_EXPIRY_DAYS` | 会话过期天数（默认 7） | ❌ |
| `MAX_FILE_SIZE_MB` | 最大文件上传（默认 20） | ❌ |

## 关键词自动回复配置

编辑 `backend/src/autoreply.js`：

```javascript
const autoReplyRules = [
  { keywords: ['你好', 'hello'], reply: '您好！有什么可以帮您？' },
  { keywords: ['价格', '多少钱'], reply: '请咨询客服获取报价' },
  // 添加更多规则...
];
```

## 本地测试

```bash
cd backend
npm install
cp .env.example .env
# 编辑 .env 填入 TG_BOT_TOKEN
npm start
# 访问 http://localhost:3000
```

## 技术栈

- **前端**: 原生 JavaScript (轻量级)
- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js)
- **TG Bot**: node-telegram-bot-api
- **部署**: Docker + Docker Compose

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/session` | 创建新会话 |
| GET | `/api/session/:id` | 获取会话信息 |
| GET | `/api/messages/:id` | 获取消息历史 |
| POST | `/api/message/:id` | 发送文字消息 |
| POST | `/api/message/:id/image` | 发送图片 |
| POST | `/api/message/:id/video` | 发送视频 |
| POST | `/api/bind/:id` | 绑定 TG 会话 |

## 目录结构

```
chatkefu/
├── backend/
│   ├── public/index.html      # 客服网页
│   ├── src/
│   │   ├── server.js          # 主服务器（支持话题模式）
│   │   ├── database.js        # 数据库
│   │   └── autoreply.js       # 自动回复
│   ├── routes/api.js          # API 路由
│   ├── storage/               # 数据存储
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## 话题模式说明

**什么是话题模式？**
Telegram 群组的"话题"功能允许将群聊分成多个独立的讨论区（类似论坛分区）。

**本系统如何支持？**
- 每个话题可以有独立的客服会话
- 消息会自动发送到对应话题
- 会话绑定支持 `chat_id + topic_id` 组合

**使用场景**：
- 多产品线客服（每个产品一个话题）
- 多语言支持（每个语言一个话题）
- 分级客服（咨询/投诉/建议分开）

## License

MIT
