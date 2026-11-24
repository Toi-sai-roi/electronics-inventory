// routes/assistant.js
const express = require('express');
const { askChatbot } = require('../services/chatbot');

const router = express.Router();

router.post('/ask', async (req, res) => {
    const message = String(req.body.message || '').trim().slice(0, 500);
    if (!message) return res.status(400).json({ ok: false, error: 'Hãy nhập câu hỏi' });
    
    // Cắt theo LƯỢT (user+model = 1 lượt), giữ 8 lượt = 16 message
    let history = [];
    if (Array.isArray(req.body.history)) {
        const clean = req.body.history.filter(h => h && typeof h.text === 'string' && (h.role === 'user' || h.role === 'model'));
        history = clean.slice(-16); // 8 lượt
    }

    try {
        const { reply, calls } = await askChatbot(message, history);
        res.json({ ok: true, reply, calls });
    } catch (e) {
        const busy = /503|UNAVAILABLE|429/.test(e.message);
        res.status(busy ? 503 : 500).json({
            ok: false,
            error: busy ? 'AI đang bận, thử lại sau ít phút' : 'Lỗi trợ lý: ' + e.message,
        });
    }
});

module.exports = router;