require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL,
    contents: 'Điện trở 10kΩ dùng để làm gì? Trả lời đúng 1 câu.',
  });
  console.log(response.text);
}

main().catch((err) => console.error('Lỗi:', err.message));