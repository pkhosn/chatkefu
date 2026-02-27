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
const sessionMap = new Map();

// 中间件
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../storage/uploads')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', apiRoutes({ bot, sessionMap }));

// Telegram Bot 事件处理
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;
  
  console.log(`📥 TG 收到消息 from ${chatId}: ${text.substring(0, 50)}`);
  
  const webSessionId = sessionMap.get(`tg_${chatId}`);
  if (webSessionId) {
    db.saveMessage({ sessionId: webSessionId, from: 'agent', type: 'text', content: text, telegramMessageId: msg.message_id });
  } else {
    const autoReply = checkAutoReply(text);
    if (autoReply) {
      bot.sendMessage(chatId, autoReply);
    }
  }
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1];
  const caption = msg.caption || '';
  const webSessionId = sessionMap.get(`tg_${chatId}`);
  if (webSessionId) {
    const fileLink = await bot.getFileLink(photo.file_id);
    db.saveMessage({ sessionId: webSessionId, from: 'agent', type: 'image', content: fileLink.toString(), caption, telegramMessageId: msg.message_id });
  }
});

bot.on('video', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';
  const webSessionId = sessionMap.get(`tg_${chatId}`);
  if (webSessionId) {
    const fileLink = await bot.getFileLink(msg.video.file_id);
    db.saveMessage({ sessionId: webSessionId, from: 'agent', type: 'video', content: fileLink.toString(), caption, telegramMessageId: msg.message_id });
  }
});

// 启动函数
async function start() {
  await db.init();
  
  app.listen(PORT, '0.0.0.0', async () => {
    try {
      const botInfo = await bot.getMe();
      console.log(`
╔════════════════════════════════════════════════════════╗
║           🚀 ChatKefu 服务已启动                        ║
╠════════════════════════════════════════════════════════╣
║  网页访问：http://0.0.0.0:${PORT}                        ║
║  TG Bot:   @${botInfo.username}                         ║
║  会话保存：${process.env.SESSION_EXPIRY_DAYS || 7}天                        ║
║  最大文件：${process.env.MAX_FILE_SIZE_MB || 20}MB                       ║
╚════════════════════════════════════════════════════════╝
`);
    } catch (err) {
      console.log(`🚀 ChatKefu 服务已启动 - http://0.0.0.0:${PORT}`);
    }
  });
}

start();

process.on('SIGTERM', () => {
  console.log('👋 服务正在关闭...');
  db.close();
  process.exit(0);
});

module.exports = { app, bot, sessionMap };
