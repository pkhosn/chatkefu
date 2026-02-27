const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../storage/chatkefu.db');
const SESSION_EXPIRY_DAYS = parseInt(process.env.SESSION_EXPIRY_DAYS) || 7;

// 确保存储目录存在
const storageDir = path.dirname(DB_PATH);
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const db = new Database(DB_PATH);

// 初始化数据库表
db.exec(`
  -- 会话表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    tg_chat_id INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER DEFAULT (strftime('%s', 'now') + ${SESSION_EXPIRY_DAYS * 86400})
  );

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    from_user TEXT NOT NULL,  -- 'user' 或 'agent'
    type TEXT NOT NULL,       -- 'text', 'image', 'video'
    content TEXT NOT NULL,
    caption TEXT,
    telegram_message_id INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- 创建索引
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_tg ON sessions(tg_chat_id);
`);

// 定期清理过期会话（每 24 小时）
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare('DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE expires_at < ?)');
  const result = stmt.run(now);
  const stmt2 = db.prepare('DELETE FROM sessions WHERE expires_at < ?');
  const result2 = stmt2.run(now);
  if (result.changes > 0 || result2.changes > 0) {
    console.log(`🧹 清理了 ${result2.changes} 个过期会话和 ${result.changes} 条消息`);
  }
}, 24 * 60 * 60 * 1000);

module.exports = {
  // 创建新会话
  createSession(tgChatId = null) {
    const id = require('uuid').v4();
    const stmt = db.prepare('INSERT INTO sessions (id, tg_chat_id) VALUES (?, ?)');
    stmt.run(id, tgChatId);
    console.log(`📝 创建新会话：${id}`);
    return { id, tg_chat_id: tgChatId };
  },

  // 获取会话
  getSession(sessionId) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(sessionId);
  },

  // 通过 TG Chat ID 获取会话
  getSessionByTgChatId(tgChatId) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE tg_chat_id = ?');
    return stmt.get(tgChatId);
  },

  // 绑定会话到 TG Chat
  bindSessionToTg(sessionId, tgChatId) {
    const stmt = db.prepare('UPDATE sessions SET tg_chat_id = ?, updated_at = strftime("%s", "now") WHERE id = ?');
    stmt.run(tgChatId, sessionId);
  },

  // 更新会话时间
  touchSession(sessionId) {
    const stmt = db.prepare('UPDATE sessions SET updated_at = strftime("%s", "now"), expires_at = strftime("%s", "now") + ? WHERE id = ?');
    stmt.run(SESSION_EXPIRY_DAYS * 86400, sessionId);
  },

  // 保存消息
  saveMessage({ sessionId, from, type, content, caption = null, telegramMessageId = null }) {
    const stmt = db.prepare(`
      INSERT INTO messages (session_id, from_user, type, content, caption, telegram_message_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(sessionId, from, type, content, caption, telegramMessageId);
    
    // 更新会话时间
    this.touchSession(sessionId);
    
    return { id: result.lastInsertRowid, sessionId };
  },

  // 获取会话消息历史
  getMessages(sessionId, limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC 
      LIMIT ?
    `);
    return stmt.all(sessionId, limit);
  },

  // 关闭数据库
  close() {
    db.close();
  }
};
