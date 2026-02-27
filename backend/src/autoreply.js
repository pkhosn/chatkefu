/**
 * 自动回复配置
 * 添加你的关键词和回复内容
 */
const autoReplyRules = [
  {
    keywords: ['你好', 'hello', 'hi', '您好'],
    reply: '👋 您好！欢迎联系在线客服，请问有什么可以帮您？'
  },
  {
    keywords: ['价格', '多少钱', '费用', '报价'],
    reply: '💰 关于价格问题，请告诉我您需要的具体服务，我会为您详细介绍。'
  },
  {
    keywords: ['工作时间', '营业时间', '几点'],
    reply: '🕐 我们的工作时间是每天 9:00-21:00，如有紧急问题请留言，我们会尽快回复。'
  },
  {
    keywords: ['联系', '电话', '微信'],
    reply: '📞 您可以通过此客服系统直接与我们沟通，我们会及时回复您的消息。'
  },
  {
    keywords: ['再见', '拜拜', 'bye'],
    reply: '👋 感谢您的咨询，如有任何问题欢迎随时联系我们！祝您生活愉快！'
  }
];

/**
 * 检查消息是否匹配自动回复规则
 * @param {string} message - 用户消息
 * @returns {string|null} - 匹配的回复内容，无匹配返回 null
 */
function checkAutoReply(message) {
  if (!message) return null;
  
  const lowerMsg = message.toLowerCase();
  
  for (const rule of autoReplyRules) {
    for (const keyword of rule.keywords) {
      if (lowerMsg.includes(keyword.toLowerCase())) {
        console.log(`🤖 自动回复匹配："${keyword}" -> "${rule.reply}"`);
        return rule.reply;
      }
    }
  }
  
  return null;
}

module.exports = {
  autoReplyRules,
  checkAutoReply
};
