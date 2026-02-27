// API 配置
const API_BASE = window.location.origin + '/api';

// 状态
let sessionId = localStorage.getItem('chatkefu_sessionId');
let messages = [];

// DOM 元素
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');

// 初始化
async function init() {
  if (!sessionId) {
    // 创建新会话
    await createSession();
  } else {
    // 验证会话
    const valid = await validateSession();
    if (!valid) {
      await createSession();
    }
  }
  
  // 加载消息历史
  await loadMessages();
  
  // 绑定事件
  bindEvents();
}

// 创建会话
async function createSession() {
  try {
    const res = await fetch(`${API_BASE}/session`, { method: 'POST' });
    const data = await res.json();
    
    if (data.success) {
      sessionId = data.sessionId;
      localStorage.setItem('chatkefu_sessionId', sessionId);
      console.log('✅ 会话创建:', sessionId);
    } else {
      showError('创建会话失败');
    }
  } catch (error) {
    console.error('创建会话失败:', error);
    showError('网络连接失败，请刷新页面重试');
  }
}

// 验证会话
async function validateSession() {
  try {
    const res = await fetch(`${API_BASE}/session/${sessionId}`);
    const data = await res.json();
    return data.success;
  } catch (error) {
    console.error('验证会话失败:', error);
    return false;
  }
}

// 加载消息历史
async function loadMessages() {
  try {
    const res = await fetch(`${API_BASE}/messages/${sessionId}`);
    const data = await res.json();
    
    if (data.success) {
      messages = data.messages;
      renderMessages();
    }
  } catch (error) {
    console.error('加载消息失败:', error);
  }
}

// 渲染消息
function renderMessages() {
  if (messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="welcome">
        <h2>👋 欢迎来到客服中心</h2>
        <p>请描述您的问题，我们会尽快回复您</p>
      </div>
    `;
  } else {
    messagesContainer.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
  }
  scrollToBottom();
}

// 创建消息 HTML
function createMessageHTML(msg) {
  const isUser = msg.from_user === 'user';
  const className = isUser ? 'user' : 'agent';
  
  let content = '';
  
  if (msg.type === 'text') {
    content = `<div class="message-bubble">${escapeHtml(msg.content)}</div>`;
  } else if (msg.type === 'image') {
    content = `
      <div class="message-bubble">
        ${msg.caption ? `<div class="message-caption">${escapeHtml(msg.caption)}</div>` : ''}
        <div class="message-image">
          <img src="${msg.content}" alt="图片" loading="lazy">
        </div>
      </div>
    `;
  } else if (msg.type === 'video') {
    content = `
      <div class="message-bubble">
        ${msg.caption ? `<div class="message-caption">${escapeHtml(msg.caption)}</div>` : ''}
        <div class="message-video">
          <video src="${msg.content}" controls></video>
        </div>
      </div>
    `;
  }
  
  return `<div class="message ${className}">${content}</div>`;
}

// 发送文字消息
async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content) return;
  
  messageInput.value = '';
  messageInput.disabled = true;
  sendBtn.disabled = true;
  
  // 添加到本地消息列表
  messages.push({
    from_user: 'user',
    type: 'text',
    content,
    created_at: Math.floor(Date.now() / 1000)
  });
  renderMessages();
  
  try {
    const res = await fetch(`${API_BASE}/message/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    
    // 重新加载消息（获取自动回复）
    setTimeout(() => loadMessages(), 500);
  } catch (error) {
    console.error('发送消息失败:', error);
    showError('发送失败，请重试');
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

// 发送文件（图片/视频）
async function sendFile(file) {
  const formData = new FormData();
  formData.append(file.type.startsWith('image/') ? 'image' : 'video', file);
  
  const endpoint = file.type.startsWith('image/') ? 'image' : 'video';
  
  try {
    const res = await fetch(`${API_BASE}/message/${sessionId}/${endpoint}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    
    // 重新加载消息
    setTimeout(() => loadMessages(), 500);
  } catch (error) {
    console.error('发送文件失败:', error);
    showError('发送失败：' + error.message);
  }
}

// 绑定事件
function bindEvents() {
  // 发送按钮
  sendBtn.addEventListener('click', sendMessage);
  
  // 回车发送
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // 文件选择
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // 检查文件大小（20MB）
      if (file.size > 20 * 1024 * 1024) {
        alert('文件大小不能超过 20MB');
        return;
      }
      sendFile(file);
      fileInput.value = ''; // 重置
    }
  });
}

// 工具函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  messagesContainer.appendChild(errorDiv);
  scrollToBottom();
  
  setTimeout(() => errorDiv.remove(), 5000);
}

// 启动
init();
