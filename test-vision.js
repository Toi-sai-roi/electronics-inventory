require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const PROMPT = `Đây là ảnh nhãn, bao bì, mạch hoặc hóa đơn của một linh kiện điện tử.
Đọc chữ in trên ảnh và điền thông tin sản phẩm. Quy tắc:
- Chỉ dùng thông tin nhìn thấy trên ảnh, không đoán. Ưu tiên chữ/mã in trên linh kiện hoặc bao bì, không nhận diện bằng hình dáng.
- ProductName: tên hoặc mã linh kiện (vd LM358, ESP32 DevKit V1).
- ProductType: chọn 1 trong: Vi điều khiển, Cảm biến, Điện trở, Tụ điện, IC, LED, Module, Phụ kiện. Không chắc thì để chuỗi rỗng.
- Quantity: số lượng nếu ghi trên ảnh, không có thì 0.
- Unit: đơn vị (cái, bộ, cuộn...), không rõ thì "cái".
- Price: giá bằng VND, số nguyên, không có thì 0.
- Description: thông số kỹ thuật đọc được (điện áp, điện trở, package...), không có thì chuỗi rỗng.
Nếu ảnh có nhiều linh kiện, chỉ lấy linh kiện nổi bật nhất.`;

async function main() {
  const file = process.argv[2];
  if (!file) return console.log('Cách dùng: node test-vision.js test-images/anh.jpg');

  const mimeType = MIME[path.extname(file).toLowerCase()];
  if (!mimeType) return console.log('Chỉ nhận ảnh jpg, png, webp');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL,
    contents: [
      { inlineData: { mimeType, data: fs.readFileSync(file).toString('base64') } },
      { text: PROMPT },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ProductName: { type: Type.STRING },
          ProductType: { type: Type.STRING },
          Quantity: { type: Type.INTEGER },
          Unit: { type: Type.STRING },
          Price: { type: Type.INTEGER },
          Description: { type: Type.STRING },
        },
        required: ['ProductName', 'ProductType', 'Quantity', 'Unit', 'Price', 'Description'],
      },
    },
  });

  console.log(JSON.parse(response.text));
}

main().catch((err) => console.error('Lỗi:', err.message));