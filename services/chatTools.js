const { Type } = require('@google/genai');
const pool = require('../db');

const MAX_ROWS = 10;
const STANDARD_TYPES = ['Vi điều khiển', 'Cảm biến', 'Điện trở', 'Tụ điện', 'IC', 'LED', 'Module', 'Phụ kiện'];
const COLS = 'ProductID, ProductName, ProductType, Quantity, Unit, Price, Description, CreateDate';
const SORTS = {
  price_asc: 'Price ASC',
  price_desc: 'Price DESC',
  quantity_asc: 'Quantity ASC',
  quantity_desc: 'Quantity DESC',
  name: 'ProductName ASC',
};

const num = (v) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? undefined : Number(v));

// Khai báo cho Gemini biết có những hàm nào
const declarations = [
  {
    name: 'search_products',
    description:
      'Tìm linh kiện trong kho theo từ khóa (tên, loại, mô tả), có thể lọc thêm theo loại, khoảng giá, khoảng số lượng và sắp xếp. ' +
      'Trả về tối đa 10 dòng kèm tổng số dòng khớp (total_matches). Dùng cho: còn bao nhiêu X, có X không, giá bao nhiêu, ' +
      'món nào rẻ nhất, gợi ý linh kiện.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: { type: Type.STRING, description: 'Từ khóa ngắn 1-2 từ, vd "ESP32", "khói", "relay". Bỏ trống nếu chỉ lọc theo loại, giá hoặc số lượng.' },
        type: { type: Type.STRING, description: 'Loại: Vi điều khiển, Cảm biến, Điện trở, Tụ điện, IC, LED, Module, Phụ kiện.' },
        min_price: { type: Type.INTEGER, description: 'Giá tối thiểu (VND).' },
        max_price: { type: Type.INTEGER, description: 'Giá tối đa (VND, tính cả mốc). "Dưới 30 nghìn" thì dùng 30000.' },
        min_quantity: { type: Type.INTEGER, description: 'Số lượng tồn tối thiểu. "Còn trên 20 cái" thì dùng 21.' },
        max_quantity: { type: Type.INTEGER, description: 'Số lượng tồn tối đa.' },
        sort: { type: Type.STRING, description: 'Một trong: price_asc (rẻ nhất trước), price_desc (đắt nhất trước), quantity_asc, quantity_desc, name.' },
        page: { type: Type.INTEGER, description: 'Trang kết quả, bắt đầu từ 1. Dùng khi câu trước đã xem trang 1 và người dùng muốn xem tiếp.' },
      },
    },
  },
  {
    name: 'list_products',
    description: 'Liệt kê toàn bộ sản phẩm trong kho theo trang (mỗi trang 10 dòng). Dùng khi cần xem hoặc duyệt cả kho. Gọi nhiều trang nếu cần xem tiếp.',
    parameters: {
      type: Type.OBJECT,
      properties: { page: { type: Type.INTEGER, description: 'Số trang, bắt đầu từ 1.' } },
    },
  },
  {
    name: 'low_stock',
    description: 'Liệt kê hàng sắp hết (số lượng tồn nhỏ hơn hoặc bằng ngưỡng), ít nhất xếp trước.',
    parameters: {
      type: Type.OBJECT,
      properties: { threshold: { type: Type.INTEGER, description: 'Ngưỡng sắp hết, mặc định 10.' } },
    },
  },
  {
    name: 'list_types',
    description: 'Liệt kê các loại linh kiện trong kho, số mặt hàng và tổng số lượng của mỗi loại.',
  },
  {
    name: 'inventory_summary',
    description: 'Số liệu tổng hợp của cả kho: tổng số mặt hàng, tổng số lượng, tổng giá trị tồn kho, số loại. Dùng cho câu hỏi tổng cộng, tổng giá trị.',
  },
  {
    name: 'find_anomalies',
    description:
      'Kiểm tra toàn kho để tìm dữ liệu bất thường: giá 0 hoặc quá cao, số lượng 0, mô tả trống, loại không chuẩn, tên quá ngắn, trùng tên, bản sao. ' +
      'Dùng cho câu hỏi kiểu: có gì bất thường, dữ liệu nào sai, sản phẩm nào lạ.',
  },
  {
    name: 'no_lookup',
    description:
      'Gọi hàm này khi câu hỏi KHÔNG cần tra kho: chào hỏi, cảm ơn, ngoài phạm vi, yêu cầu thêm/sửa/xóa dữ liệu, hoặc cần hỏi lại người dùng cho rõ. Không có tham số.',
  },
];

// Chỉ giữ các trường cần thiết; mô tả cắt ngắn để chữ lạ trong dữ liệu không lấn át lời dặn
const shape = (rows) =>
  rows.map((r) => ({
    id: r.ProductID,
    name: r.ProductName,
    type: r.ProductType,
    quantity: r.Quantity,
    unit: r.Unit,
    price_vnd: Number(r.Price),
    description: String(r.Description || '').slice(0, 160),
    created_at: r.CreateDate ? new Date(r.CreateDate).toLocaleDateString('vi-VN') : '',
  }));

// Cài đặt thật của từng hàm: chỉ SELECT, giá trị truyền bằng dấu ?
const impl = {
    async search_products(args) {
    const where = [];
    const params = [];
    String(args.keyword || '').trim().split(/\s+/).filter(Boolean).forEach((w) => {
      const like = '%' + w + '%';
      where.push('(ProductName LIKE ? OR ProductType LIKE ? OR Description LIKE ?)');
      params.push(like, like, like);
    });
    if (args.type) { where.push('ProductType LIKE ?'); params.push('%' + String(args.type).trim() + '%'); }
    const min = num(args.min_price);
    const max = num(args.max_price);
    const minQ = num(args.min_quantity);
    const maxQ = num(args.max_quantity);
    if (min !== undefined) { where.push('Price >= ?'); params.push(min); }
    if (max !== undefined) { where.push('Price <= ?'); params.push(max); }
    if (minQ !== undefined) { where.push('Quantity >= ?'); params.push(minQ); }
    if (maxQ !== undefined) { where.push('Quantity <= ?'); params.push(maxQ); }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const order = SORTS[args.sort] || SORTS.name;
    const page = Math.max(parseInt(args.page) || 1, 1);
    const offset = (page - 1) * MAX_ROWS;

    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM Product ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT ${COLS} FROM Product ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, MAX_ROWS, offset]
    );
    if (!rows.length) return { found: 0, total_matches: 0, page, items: [], note: page > 1 ? `Trang ${page} rỗng.` : 'Không có sản phẩm nào khớp trong kho.' };
    return {
      found: rows.length,
      total_matches: n,
      page,
      per_page: MAX_ROWS,
      total_pages: Math.ceil(n / MAX_ROWS),
      truncated: n > offset + rows.length,
      items: shape(rows),
    };
  },

  async list_products(args) {
    const page = Math.max(parseInt(args.page) || 1, 1);
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM Product');
    const [rows] = await pool.query(
      `SELECT ${COLS} FROM Product ORDER BY ProductID ASC LIMIT ? OFFSET ?`,
      [MAX_ROWS, (page - 1) * MAX_ROWS]
    );
    return {
      total_products: n,
      page,
      per_page: MAX_ROWS,
      total_pages: Math.ceil(n / MAX_ROWS),
      found: rows.length,
      items: shape(rows),
    };
  },

  async low_stock(args) {
    const threshold = num(args.threshold) ?? 10;
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM Product WHERE Quantity <= ?', [threshold]);
    const [rows] = await pool.query(
      `SELECT ${COLS} FROM Product WHERE Quantity <= ? ORDER BY Quantity ASC LIMIT ?`,
      [threshold, MAX_ROWS]
    );
    return {
      threshold,
      found: rows.length,
      total_matches: n,
      truncated: n > rows.length,
      items: shape(rows),
      ...(n === 0 ? { note: 'Không có mặt hàng nào tồn từ ngưỡng này trở xuống.' } : {}),
    };
  },

  async list_types() {
    const [rows] = await pool.query(
      `SELECT ProductType, COUNT(*) AS items, SUM(Quantity) AS total_quantity
       FROM Product GROUP BY ProductType ORDER BY ProductType`
    );
    return {
      types: rows.map((r) => ({ type: r.ProductType, items: r.items, total_quantity: Number(r.total_quantity) })),
    };
  },

  async inventory_summary() {
    const [[s]] = await pool.query(
      `SELECT COUNT(*) AS total_products,
              COALESCE(SUM(Quantity), 0) AS total_quantity,
              COALESCE(SUM(Quantity * Price), 0) AS total_value,
              COUNT(DISTINCT ProductType) AS type_count
       FROM Product`
    );
    return {
      total_products: Number(s.total_products),
      total_quantity: Number(s.total_quantity),
      total_value_vnd: Number(s.total_value),
      type_count: Number(s.type_count),
    };
  },

  async find_anomalies() {
    const placeholders = STANDARD_TYPES.map(() => '?').join(',');
    const checks = [
      ['gia_bang_0_hoac_qua_cao', 'Price = 0 OR Price > 5000000', []],
      ['so_luong_bang_0', 'Quantity = 0', []],
      ['mo_ta_trong', "Description IS NULL OR TRIM(Description) = ''", []],
      ['loai_khong_chuan', `ProductType NOT IN (${placeholders})`, STANDARD_TYPES],
      ['ten_qua_ngan', 'CHAR_LENGTH(TRIM(ProductName)) < 3', []],
      ['ban_sao', "ProductName LIKE '%(bản sao)%'", []],
      ['trung_ten', 'ProductName IN (SELECT ProductName FROM Product GROUP BY ProductName HAVING COUNT(*) > 1)', []],
    ];
    const issues = {};
    for (const [key, cond, params] of checks) {
      const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM Product WHERE ${cond}`, params);
      if (!n) continue;
      const [rows] = await pool.query(
        `SELECT ${COLS} FROM Product WHERE ${cond} ORDER BY ProductID ASC LIMIT ?`,
        [...params, MAX_ROWS]
      );
      issues[key] = { count: n, items: shape(rows) };
    }
    return {
      issue_groups: Object.keys(issues).length,
      issues,
      note: 'Chỉ phát hiện lỗi hình thức (giá, số lượng, mô tả, loại chuẩn, tên ngắn, trùng tên, bản sao). Không phát hiện được tên và mô tả không khớp nhau về nội dung.',
    };
  },

  async no_lookup() {
    return { ok: true };
  },
};

// Chạy hàm theo tên Gemini yêu cầu; hàm lạ hoặc lỗi thì trả về lỗi thay vì làm sập app
async function run(name, args) {
  if (!impl[name]) return { error: 'Hàm không tồn tại: ' + name };
  try {
    return await impl[name](args || {});
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { declarations, run, MAX_ROWS };