const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../src/database');
const { checkAutoReply } = require('../src/autoreply');

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB) || 20;

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../storage/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 }
});

module.exports = ({ bot, sessionMap }) => {
  const router = express.Router();

  // 创建新会话
  router.post('/session', (req, res) => {
    try {
      const session = db.createSession();
      res.json({ success: true, sessionId: session.id });
    } catch (error) {
      console.error('创建会话失败:', error);
      res.status(500).json({ success: false, error: '创建会话失败' });
    }
  });

  // 获取会话信息
  router.get('/session/:sessionId', (req, res) => {
    try {
      const session = db.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '会话不存在' });
      }
      
      // 检查是否过期
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at < now) {
        return res.status(410).json({ success: false, error: '会话已过期' });
      }
      
      res.json({ success: true, session });
    } catch (error) {
      console.error('获取会话失败:', error);
      res.status(500).json({ success: false, error: '获取会话失败' });
    }
  });

  // 获取消息历史
  router.get('/messages/:sessionId', (req, res) => {
    try {
      const session = db.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '会话不存在' });
      }
      
      const messages = db.getMessages(req.params.sessionId);
      res.json({ success: true, messages });
    } catch (error) {
      console.error('获取消息失败:', error);
      res.status(500).json({ success: false, error: '获取消息失败' });
    }
  });

  // 发送消息（文字）
  router.post('/message/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const { content } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ success: false, error: '消息内容不能为空' });
      }
      
      const session = db.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '会话不存在' });
      }
      
      // 检查是否过期
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at < now) {
        return res.status(410).json({ success: false, error: '会话已过期' });
      }
      
      // 保存消息到数据库
      db.saveMessage({
        sessionId,
        from: 'user',
        type: 'text',
        content
      });
      
      // 如果有 TG 绑定，转发给客服
      if (session.tg_chat_id) {
        bot.sendMessage(session.tg_chat_id, content)
          .then(() => console.log(`📤 消息已转发给客服 ${session.tg_chat_id}`))
          .catch(err => console.error('转发消息失败:', err));
      } else {
        // 新对话，检查自动回复
        const autoReply = checkAutoReply(content);
        if (autoReply) {
          // 延迟回复，模拟真人
          setTimeout(() => {
            db.saveMessage({ sessionId, from: 'agent', type: 'text', content: autoReply });
          }, 1000);
        }
      }
      
      // 更新会话时间
      db.touchSession(sessionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('发送消息失败:', error);
      res.status(500).json({ success: false, error: '发送消息失败' });
    }
  });

  // 发送图片
  router.post('/message/:sessionId/image', upload.single('image'), async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { caption } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择图片文件' });
      }
      
      const session = db.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '会话不存在' });
      }
      
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // 保存消息
      db.saveMessage({
        sessionId,
        from: 'user',
        type: 'image',
        content: fileUrl,
        caption
      });
      
      // 转发给客服
      if (session.tg_chat_id) {
        bot.sendPhoto(session.tg_chat_id, req.file.path, { caption })
          .then(() => console.log(`📤 图片已转发给客服 ${session.tg_chat_id}`))
          .catch(err => console.error('转发图片失败:', err));
      }
      
      db.touchSession(sessionId);
      res.json({ success: true, fileUrl });
    } catch (error) {
      console.error('发送图片失败:', error);
      res.status(500).json({ success: false, error: '发送图片失败' });
    }
  });

  // 发送视频
  router.post('/message/:sessionId/video', upload.single('video'), async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { caption } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请选择视频文件' });
      }
      
      const session = db.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '会话不存在' });
      }
      
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // 保存消息
      db.saveMessage({
        sessionId,
        from: 'user',
        type: 'video',
        content: fileUrl,
        caption
      });
      
      // 转发给客服
      if (session.tg_chat_id) {
        bot.sendVideo(session.tg_chat_id, req.file.path, { caption })
          .then(() => console.log(`📤 视频已转发给客服 ${session.tg_chat_id}`))
          .catch(err => console.error('转发视频失败:', err));
      }
      
      db.touchSession(sessionId);
      res.json({ success: true, fileUrl });
    } catch (error) {
      console.error('发送视频失败:', error);
      res.status(500).json({ success: false, error: '发送视频失败' });
    }
  });

  // 绑定 TG 会话（客服首次回复时调用）
  router.post('/bind/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const { tgChatId } = req.body;
      
      if (!tgChatId) {
        return res.status(400).json({ success: false, error: '缺少 tgChatId' });
      }
      
      const session = db.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: '会话不存在' });
      }
      
      db.bindSessionToTg(sessionId, tgChatId);
      sessionMap.set(`tg_${tgChatId}`, sessionId);
      
      console.log(`🔗 会话绑定：${sessionId} <-> TG:${tgChatId}`);
      res.json({ success: true });
    } catch (error) {
      console.error('绑定会话失败:', error);
      res.status(500).json({ success: false, error: '绑定会话失败' });
    }
  });

  return router;
};
