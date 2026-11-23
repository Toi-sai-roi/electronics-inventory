require('dotenv').config();
const { askChatbot } = require('./services/chatbot');

(async () => {
  for (const q of process.argv.slice(2)) {
    const r = await askChatbot(q);
    console.log('\nHỏi:', q);
    console.log('Hàm AI đã gọi:', JSON.stringify(r.calls));
    console.log('Trả lời:', r.reply);
  }
  process.exit(0);
})().catch((e) => { console.error('Lỗi:', e.message); process.exit(1); });