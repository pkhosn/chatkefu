# ChatKefu 部署指南

## ✅ 项目完成状态

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| 网页客服界面 | ✅ 完成 | 支持文字/图片/视频 |
| Telegram Bot | ✅ 完成 | 双向通信 |
| 群组话题模式 | ✅ 完成 | 支持 Topics |
| 会话管理 | ✅ 完成 | 7 天自动过期 |
| 自动回复 | ✅ 完成 | 10 条预设规则 |
| 数据库存储 | ✅ 完成 | SQLite |
| Docker 部署 | ✅ 完成 | docker-compose |
| GitHub 仓库 | ✅ 完成 | 已推送 |

---

## 🚀 VPS 部署步骤

### 1. 准备工作

```bash
# SSH 登录 VPS
ssh root@your-vps-ip

# 安装 Docker (如未安装)
curl -fsSL https://get.docker.com | bash

# 安装 Docker Compose
apt install docker-compose-plugin -y
```

### 2. 克隆项目

```bash
cd /opt
git clone https://github.com/pkhosn/chatkefu.git
cd chatkefu
```

### 3. 配置环境变量

```bash
cp .env.example .env
nano .env
```

**编辑 .env 文件：**

```env
# Telegram Bot Token (必填)
TG_BOT_TOKEN=你的_bot_token

# Telegram 群组 ID (可选，话题模式需要)
# 获取方法：转发群组消息给 @userinfobot
TG_GROUP_ID=-1001234567890

# Telegram 话题 ID (可选)
# 获取方法：查看话题 URL 中的数字
TG_TOPIC_ID=123

# 服务端口
PORT=3000

# 会话过期天数
SESSION_EXPIRY_DAYS=7

# 最大文件上传 (MB)
MAX_FILE_SIZE_MB=20
```

### 4. 启动服务

```bash
# 后台启动
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### 5. 配置防火墙

```bash
# 开放端口 (如果使用非 3000 端口)
ufw allow 3000/tcp

# 或者使用 iptables
iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

### 6. 访问客服页面

```
http://your-vps-ip:3000
```

---

## 🔧 获取群组 ID 和话题 ID

### 方法 1：通过 Bot 日志

1. 在群组话题中发送一条消息
2. 查看服务日志：`docker compose logs -f`
3. 查找 `message_thread_id`

### 方法 2：通过 URL

- 话题 URL 格式：`https://t.me/c/xxxxxxxxxx/topicId`
- `xxxxxxxxxx` = 群组 ID（前面加 -100）
- `topicId` = 话题 ID

### 方法 3：转发给 @userinfobot

1. 转发一条群组消息给 @userinfobot
2. 它会告诉你群组 ID

---

## 📝 自定义自动回复

编辑 `backend/src/autoreply.js`：

```javascript
const autoReplyRules = [
  { 
    keywords: ['你好', 'hello'], 
    reply: '您好！有什么可以帮您？' 
  },
  // 添加更多规则...
];
```

修改后重启：
```bash
docker compose restart
```

---

## 🔒 安全建议

### 1. 使用 HTTPS（推荐）

使用 Caddy 作为反向代理：

```bash
# 安装 Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy
```

配置 `/etc/caddy/Caddyfile`：
```
your-domain.com {
    reverse_proxy localhost:3000
}
```

### 2. 限制访问 IP

```bash
# 只允许特定 IP 访问
ufw allow from 1.2.3.4 to any port 3000
```

### 3. 定期备份

```bash
# 备份数据库
cp backend/storage/chatkefu.db ./backup-$(date +%Y%m%d).db
```

---

## 📊 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新代码
git pull
docker compose up -d --build

# 清理过期数据
docker compose exec chatkefu rm -f storage/chatkefu.db
```

---

## ❓ 故障排查

### 问题 1：Bot 无法接收消息

**检查：**
- Token 是否正确
- Bot 是否被群组移除
- Bot 是否有读取消息权限

**解决：**
```bash
docker compose logs | grep "TG 收到消息"
```

### 问题 2：网页无法访问

**检查：**
- 端口是否开放
- 服务是否运行
- 防火墙配置

**解决：**
```bash
netstat -tlnp | grep 3000
ufw status
```

### 问题 3：消息无法转发

**检查：**
- 会话是否绑定
- 群组 ID 是否正确
- 话题 ID 是否匹配

**解决：**
```bash
docker compose logs | grep "消息已转发"
```

---

## 📞 技术支持

- GitHub: https://github.com/pkhosn/chatkefu
- Telegram Bot: @opcdgongju_bot

---

**最后更新**: 2026-03-01
**版本**: 1.0.0
