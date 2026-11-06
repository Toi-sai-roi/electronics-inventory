const { GoogleGenAI, Type } = require('@google/genai');

const PROMPT = `Đây là ảnh nhãn, bao bì, mạch hoặc hóa đơn của một linh kiện điện tử.
Đọc chữ in trên ảnh và điền thông tin sản phẩm. Quy tắc:
- Chỉ dùng thông tin nhìn thấy trên ảnh, không đoán. Ưu tiên chữ/mã in trên linh kiện hoặc bao bì, không nhận diện bằng hình dáng.
- ProductName: tên hoặc mã linh kiện in trên ảnh (vd LM358, DHT11). Nhãn chân (VCC, GND, AO, DO, OUT, SDA, SCL, TX, RX...) KHÔNG phải tên. Nếu không có tên hoặc mã in rõ, đặt tên theo chức năng nhận ra từ ảnh (vd "Module cảm biến lửa") và nói rõ trong Reason là dựa vào hình dáng.
- ProductType: chọn 1 trong: Vi điều khiển, Cảm biến, Điện trở, Tụ điện, IC, LED, Module, Phụ kiện. Module có chức năng cảm biến thì chọn Cảm biến. Không chắc thì để chuỗi rỗng.
- Quantity: số lượng nếu ghi trên ảnh, không có thì 0.
- Unit: đơn vị (cái, bộ, cuộn...), không rõ thì "cái".
- Price: giá bằng VND, số nguyên, không có thì 0.
- Description: chỉ thông số kỹ thuật (chip, điện áp, điện trở, giao tiếp, package). Bỏ qua mã chứng nhận (FCC ID, CE, RoHS), số lô, mã vạch. Không có thì chuỗi rỗng.
Nếu ảnh có nhiều linh kiện, chỉ lấy linh kiện nổi bật nhất.
- IsComponent: true nếu ảnh có linh kiện điện tử, bo mạch, nhãn, bao bì hoặc hóa đơn linh kiện. false nếu là ảnh khác (chụp màn hình code, người, phong cảnh...). Nếu false thì các trường còn lại để rỗng hoặc 0.
- Reason: 1 câu ngắn tiếng Việt nói ảnh này chụp gì.`;

const SCHEMA = {
    type: Type.OBJECT,
    properties: {
        ProductName: { type: Type.STRING },
        ProductType: { type: Type.STRING },
        Quantity: { type: Type.INTEGER },
        Unit: { type: Type.STRING },
        Price: { type: Type.INTEGER },
        Description: { type: Type.STRING },
        IsComponent: { type: Type.BOOLEAN },
        Reason: { type: Type.STRING },
    },
    required: ['ProductName', 'ProductType', 'Quantity', 'Unit', 'Price', 'Description', 'IsComponent', 'Reason'],
};

// Gọi lại tối đa 3 lần nếu model đang bận (503) hoặc hết hạn mức tạm thời (429)
async function withRetry(fn, tries = 3) {
    for (let i = 1; i <= tries; i++) {
        try {
            return await fn();
        } catch (err) {
            const busy = /503|UNAVAILABLE|429/.test(err.message);
            if (!busy || i === tries) throw err;
            await new Promise((r) => setTimeout(r, i * 3000));
        }
    }
}

// Nhận buffer ảnh + mimeType, trả về object 6 trường đã làm sạch
async function extractProduct(buffer, mimeType) {
    if (!process.env.GEMINI_API_KEY) throw new Error('Chưa cấu hình GEMINI_API_KEY trong .env');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await withRetry(() =>
        ai.models.generateContent({
            model: process.env.GEMINI_MODEL,
            contents: [
                { inlineData: { mimeType, data: buffer.toString('base64') } },
                { text: PROMPT },
            ],
            config: { responseMimeType: 'application/json', responseSchema: SCHEMA },
        })
    );

    const d = JSON.parse(response.text);
    return {
        IsComponent: d.IsComponent === true,
        Reason: String(d.Reason || '').trim(),
        ProductName: String(d.ProductName || '').trim(),
        ProductType: String(d.ProductType || '').trim(),
        Quantity: Math.max(0, parseInt(d.Quantity) || 0),
        Unit: String(d.Unit || '').trim() || 'cái',
        Price: Math.max(0, parseInt(d.Price) || 0),
        Description: String(d.Description || '').trim(),
    };
}

module.exports = { extractProduct };