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
const TG_GROUP_ID = process.env.TG_GROUP_ID; // 可选：群组 ID
const TG_TOPIC_ID = process.env.TG_TOPIC_ID; // 可选：默认话题 ID

if (!TG_BOT_TOKEN) {
  console.error('❌ 错误：请设置 TG_BOT_TOKEN 环境变量');
  process.exit(1);
}

const app = express();
const bot = new TelegramBot(TG_BOT_TOKEN, { polling: true });
const sessionMap = new Map(); // tg_chatId_topicId -> sessionId

// 中间件
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../storage/uploads')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', apiRoutes({ bot, sessionMap }));

// 生成会话键（支持话题模式）
function getSessionKey(chatId, topicId = null) {
  return topicId ? `tg_${chatId}_${topicId}` : `tg_${chatId}`;
}

// Telegram Bot 事件处理 - 文本消息
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const topicId = msg.message_thread_id; // 话题 ID（如果有）
  
  if (!text) return;
  
  const sessionKey = getSessionKey(chatId, topicId);
  console.log(`📥 TG 收到消息 from ${chatId}${topicId ? ` (话题:${topicId})` : ''}: ${text.substring(0, 50)}`);
  
  const webSessionId = sessionMap.get(sessionKey);
  if (webSessionId) {
    db.saveMessage({ 
      sessionId: webSessionId, 
      from: 'agent', 
      type: 'text', 
      content: text, 
      telegramMessageId: msg.message_id,
      topicId: topicId
    });
    console.log(`💾 消息已保存到会话 ${webSessionId}`);
  } else {
    // 新对话 - 检查自动回复
    const autoReply = checkAutoReply(text);
    if (autoReply) {
      bot.sendMessage(chatId, autoReply, { reply_to_message_id: msg.message_id, message_thread_id: topicId });
      console.log(`🤖 自动回复：${autoReply}`);
    }
  }
});

// 处理图片
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;
  const photo = msg.photo[msg.photo.length - 1];
  const caption = msg.caption || '';
  
  const sessionKey = getSessionKey(chatId, topicId);
  const webSessionId = sessionMap.get(sessionKey);
  
  if (webSessionId) {
    const fileLink = await bot.getFileLink(photo.file_id);
    db.saveMessage({ 
      sessionId: webSessionId, 
      from: 'agent', 
      type: 'image', 
      content: fileLink.toString(), 
      caption, 
      telegramMessageId: msg.message_id,
      topicId
    });
  }
});

// 处理视频
bot.on('video', async (msg) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;
  const caption = msg.caption || '';
  
  const sessionKey = getSessionKey(chatId, topicId);
  const webSessionId = sessionMap.get(sessionKey);
  
  if (webSessionId) {
    const fileLink = await bot.getFileLink(msg.video.file_id);
    db.saveMessage({ 
      sessionId: webSessionId, 
      from: 'agent', 
      type: 'video', 
      content: fileLink.toString(), 
      caption, 
      telegramMessageId: msg.message_id,
      topicId
    });
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
║  群组 ID:  ${TG_GROUP_ID || '未设置'}                       ║
║  话题 ID:  ${TG_TOPIC_ID || '未设置'}                       ║
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
