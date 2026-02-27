const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../storage/chatkefu.db');
const SESSION_EXPIRY_DAYS = parseInt(process.env.SESSION_EXPIRY_DAYS) || 7;

const storageDir = path.dirname(DB_PATH);
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

let db = null;

async function initDB() {
  const SQL = await initSqlJs();
  
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  } catch (err) {
    console.error('加载数据库失败:', err);
    db = new SQL.Database();
  }
  
  // 创建表（添加 topic_id 支持）
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tg_chat_id INTEGER,
      topic_id INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      expires_at INTEGER DEFAULT (strftime('%s', 'now') + ${SESSION_EXPIRY_DAYS * 86400})
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      from_user TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      caption TEXT,
      telegram_message_id INTEGER,
      topic_id INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_tg ON sessions(tg_chat_id);
  `);
  
  saveDB();
  console.log('✅ 数据库初始化完成');
  
  setInterval(() => {
    cleanupExpiredSessions();
    saveDB();
  }, 24 * 60 * 60 * 1000);
  
  setInterval(() => {
    saveDB();
  }, 60 * 1000);
}

function saveDB() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('保存数据库失败:', err);
  }
}

function cleanupExpiredSessions() {
  const now = Math.floor(Date.now() / 1000);
  db.run('DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE expires_at < ?)', [now]);
  db.run('DELETE FROM sessions WHERE expires_at < ?', [now]);
  console.log('🧹 清理了过期会话');
}

const dbOps = {
  async init() {
    await initDB();
  },
  
  createSession(tgChatId = null, topicId = null) {
    const id = uuidv4();
    db.run('INSERT INTO sessions (id, tg_chat_id, topic_id) VALUES (?, ?, ?)', [id, tgChatId, topicId]);
    saveDB();
    console.log(`📝 创建新会话：${id}${tgChatId ? ` (TG:${tgChatId}${topicId ? ` 话题:${topicId}` : ''})` : ''}`);
    return { id, tg_chat_id: tgChatId, topic_id: topicId };
  },
  
  getSession(sessionId) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    stmt.bind([sessionId]);
    let result = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      result = { 
        id: row.id, 
        tg_chat_id: row.tg_chat_id, 
        topic_id: row.topic_id,
        created_at: row.created_at, 
        updated_at: row.updated_at, 
        expires_at: row.expires_at 
      };
    }
    stmt.free();
    return result;
  },
  
  getSessionByTgChatId(tgChatId, topicId = null) {
    let stmt, result;
    if (topicId) {
      stmt = db.prepare('SELECT * FROM sessions WHERE tg_chat_id = ? AND topic_id = ?');
      stmt.bind([tgChatId, topicId]);
    } else {
      stmt = db.prepare('SELECT * FROM sessions WHERE tg_chat_id = ?');
      stmt.bind([tgChatId]);
    }
    if (stmt.step()) {
      const row = stmt.getAsObject();
      result = { 
        id: row.id, 
        tg_chat_id: row.tg_chat_id, 
        topic_id: row.topic_id,
        created_at: row.created_at, 
        updated_at: row.updated_at, 
        expires_at: row.expires_at 
      };
    }
    stmt.free();
    return result;
  },
  
  bindSessionToTg(sessionId, tgChatId, topicId = null) {
    db.run('UPDATE sessions SET tg_chat_id = ?, topic_id = ?, updated_at = strftime("%s", "now") WHERE id = ?', [tgChatId, topicId, sessionId]);
    saveDB();
  },
  
  touchSession(sessionId) {
    db.run('UPDATE sessions SET updated_at = strftime("%s", "now"), expires_at = strftime("%s", "now") + ? WHERE id = ?', [SESSION_EXPIRY_DAYS * 86400, sessionId]);
    saveDB();
  },
  
  saveMessage({ sessionId, from, type, content, caption = null, telegramMessageId = null, topicId = null }) {
    db.run(
      'INSERT INTO messages (session_id, from_user, type, content, caption, telegram_message_id, topic_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [sessionId, from, type, content, caption, telegramMessageId, topicId]
    );
    saveDB();
    this.touchSession(sessionId);
    return { sessionId };
  },
  
  getMessages(sessionId, limit = 50) {
    const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?');
    stmt.bind([sessionId, limit]);
    const messages = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      messages.push({
        id: row.id,
        session_id: row.session_id,
        from_user: row.from_user,
        type: row.type,
        content: row.content,
        caption: row.caption,
        telegram_message_id: row.telegram_message_id,
        topic_id: row.topic_id,
        created_at: row.created_at
      });
    }
    stmt.free();
    return messages;
  },
  
  close() {
    if (db) {
      saveDB();
      db.close();
    }
  }
};

module.exports = dbOps;
