# ChatKefu - 客服对话系统

基于 Telegram Bot 的网页客服系统。

## 功能

- 🌐 网页客服对话界面
- 💬 支持文字、图片、视频消息
- 🤖 Telegram Bot 双向通信
- ⏱️ 会话自动保存 7 天
- 🔑 关键词自动回复
- 🐳 Docker Compose 一键部署

## 快速开始

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

## 环境变量

| 变量 | 说明 |
|------|------|
| `TG_BOT_TOKEN` | Telegram Bot Token（必填） |
| `PORT` | 服务端口（默认 3000） |
| `SESSION_EXPIRY_DAYS` | 会话过期天数（默认 7） |
| `MAX_FILE_SIZE_MB` | 最大文件上传大小（默认 20） |

## 关键词自动回复配置

编辑 `backend/src/autoreply.js` 配置关键词规则：

```javascript
const autoReplyRules = [
  { keywords: ['你好', 'hello'], reply: '您好！有什么可以帮您？' },
  { keywords: ['价格', '多少钱'], reply: '请咨询客服获取报价' },
  // 添加更多规则...
];
```

## 技术栈

- **前端**: Vue 3 + Vite
- **后端**: Node.js + Express
- **数据库**: SQLite
- **TG Bot**: node-telegram-bot-api
- **部署**: Docker + Docker Compose

## 目录结构

```
chatkefu/
├── frontend/          # 前端代码
│   └── src/
├── backend/           # 后端代码
│   ├── src/
│   ├── routes/
│   └── storage/
├── docker/            # Docker 配置
├── docker-compose.yml
└── README.md
```

## License

MIT
