require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');
const apiRoutes = require('../routes/api');
const { checkAutoReply } = require('./autoreply');

const PORT = process.env.PORT || 3000;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;

if (!TG_BOT_TOKEN) {
  console.error('❌ 错误：请设置 TG_BOT_TOKEN 环境变量');
  process.exit(1);
}

const app = express();
const bot = new TelegramBot(TG_BOT_TOKEN, { polling: true });

// 存储会话映射：webSessionId <-> tgChatId
const sessionMap = new Map();

// 中间件
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 静态文件（上传的文件）
app.use('/uploads', express.static(path.join(__dirname, '../storage/uploads')));

// API 路由
app.use('/api', apiRoutes({ bot, sessionMap }));

// ==================== Telegram Bot 事件处理 ====================

// 接收来自 Telegram 的消息（客服回复）
bot.on('message', async (msg) => {
  // 忽略非文本消息的处理（媒体消息有专门的事件）
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!text) return; // 非文本消息由其他处理器处理
  
  console.log(`📥 TG 收到消息 from ${chatId}: ${text.substring(0, 50)}`);
  
  // 检查是否是客服回复（通过会话映射查找对应的 web 用户）
  const webSessionId = sessionMap.get(`tg_${chatId}`);
  if (webSessionId) {
    // 保存消息到数据库
    db.saveMessage({
      sessionId: webSessionId,
      from: 'agent',
      type: 'text',
      content: text,
      telegramMessageId: msg.message_id
    });
    console.log(`💾 消息已保存到会话 ${webSessionId}`);
  } else {
    // 新对话 - 检查自动回复
    const autoReply = checkAutoReply(text);
    if (autoReply) {
      bot.sendMessage(chatId, autoReply);
      console.log(`🤖 自动回复：${autoReply}`);
    }
  }
});

// 处理图片
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1]; // 获取最高分辨率
  const caption = msg.caption || '';
  
  console.log(`📥 TG 收到图片 from ${chatId}`);
  
  const webSessionId = sessionMap.get(`tg_${chatId}`);
  if (webSessionId) {
    // 下载图片
    const fileLink = await bot.getFileLink(photo.file_id);
    db.saveMessage({
      sessionId: webSessionId,
      from: 'agent',
      type: 'image',
      content: fileLink.toString(),
      caption: caption,
      telegramMessageId: msg.message_id
    });
  }
});

// 处理视频
bot.on('video', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';
  
  console.log(`📥 TG 收到视频 from ${chatId}`);
  
  const webSessionId = sessionMap.get(`tg_${chatId}`);
  if (webSessionId) {
    const fileLink = await bot.getFileLink(msg.video.file_id);
    db.saveMessage({
      sessionId: webSessionId,
      from: 'agent',
      type: 'video',
      content: fileLink.toString(),
      caption: caption,
      telegramMessageId: msg.message_id
    });
  }
});

// 处理新聊天成员
bot.on('new_chat_members', (msg) => {
  console.log(`👋 新成员加入：${msg.new_chat_members.map(m => m.username).join(', ')}`);
});

// ==================== 启动服务器 ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║           🚀 ChatKefu 服务已启动                        ║
╠════════════════════════════════════════════════════════╣
║  网页访问：http://0.0.0.0:${PORT}                        ║
║  TG Bot:   @${(await bot.getMe()).username}                   ║
║  会话保存：${process.env.SESSION_EXPIRY_DAYS || 7}天                        ║
║  最大文件：${process.env.MAX_FILE_SIZE_MB || 20}MB                       ║
╚════════════════════════════════════════════════════════╝
  `);
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('👋 服务正在关闭...');
  db.close();
  process.exit(0);
});

module.exports = { app, bot, sessionMap };
