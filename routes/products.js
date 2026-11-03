const express = require('express');
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const upload = require('../middleware/upload');
const crypto = require('crypto');
const multer = require('multer');
const ExcelJS = require('exceljs');

const router = express.Router();
const LIMIT = 10;

// ---------- Hàm dùng chung ----------

// Kiểm tra dữ liệu form, trả về mảng lỗi (rỗng = hợp lệ)
function validate(body) {
  const { ProductName, ProductType, Quantity, Unit, Price } = body;
  const errors = [];
  if (!ProductName || !ProductName.trim()) errors.push('Tên sản phẩm không được để trống');
  if (!ProductType || !ProductType.trim()) errors.push('Loại sản phẩm không được để trống');
  if (!Unit || !Unit.trim()) errors.push('Đơn vị tính không được để trống');
  if (!Number.isInteger(Number(Quantity)) || Number(Quantity) < 0) errors.push('Số lượng phải là số nguyên >= 0');
  if (isNaN(Number(Price)) || Number(Price) < 0) errors.push('Giá phải là số >= 0');
  return errors;
}

// Middleware upload: nếu upload lỗi thì render lại form kèm thông báo
function uploadImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh tối đa 5MB' : err.message;
      return res.status(400).render('products/form', {
        product: { ...req.body, ProductID: req.params.id },
        error: msg,
      });
    }
    next();
  });
}

// Xóa file ảnh trong thư mục uploads (PathImage dạng '/uploads/abc.jpg')
function removeFile(pathImage) {
  if (!pathImage) return;
  fs.unlink(path.join(__dirname, '..', pathImage), () => { });
}

// Biến chuỗi tìm kiếm thành điều kiện WHERE + mảng giá trị
function buildSearch(q) {
  const where = [];
  const params = [];
  q.split(/\s+/).filter(Boolean).forEach((word) => {
    const like = '%' + word + '%';
    const num = '%' + word.replace(/[.,]/g, '') + '%';
    where.push(`(ProductName LIKE ? OR ProductType LIKE ? OR Unit LIKE ? OR Description LIKE ?
      OR CAST(Quantity AS CHAR) LIKE ? OR CAST(Price AS CHAR) LIKE ?
      OR DATE_FORMAT(CreateDate, '%d/%m/%Y') LIKE ?)`);
    params.push(like, like, like, like, num, num, like);
  });
  return { whereSql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

// ---------- Routes ----------

// Danh sách + phân trang
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const { whereSql, params } = buildSearch(q);

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * LIMIT;

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM Product ${whereSql}`, params);
    const [products] = await pool.query(
      `SELECT * FROM Product ${whereSql} ORDER BY ProductID ASC LIMIT ? OFFSET ?`,
      [...params, LIMIT, offset]
    );

    const base = '/products?' + (q ? 'q=' + encodeURIComponent(q) + '&' : '');

    res.render('products/index', {
      products, q, base,
      page, limit: LIMIT, total,
      totalPages: Math.ceil(total / LIMIT),
    });
  } catch (err) {
    res.status(500).send('Lỗi: ' + err.message);
  }
});

// Form thêm mới  (PHẢI nằm TRƯỚC route '/:id', xem giải thích bên dưới)
router.get('/new', (req, res) => {
  res.render('products/form', { product: {}, error: null });
});

// Xử lý thêm mới
router.post('/', uploadImage, async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) {
    if (req.file) removeFile('/uploads/' + req.file.filename);
    return res.status(400).render('products/form', { product: req.body, error: errors.join('. ') });
  }

  try {
    const { ProductName, ProductType, Quantity, Unit, Price, Description } = req.body;
    const pathImage = req.file ? '/uploads/' + req.file.filename : null;
    await pool.query(
      `INSERT INTO Product (ProductName, PathImage, ProductType, Quantity, Unit, Price, Description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ProductName.trim(), pathImage, ProductType.trim(), Number(Quantity), Unit.trim(), Number(Price), Description || null]
    );

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM Product');
    res.redirect('/products?page=' + Math.ceil(total / LIMIT));
  } catch (err) {
    if (req.file) removeFile('/uploads/' + req.file.filename);
    res.status(500).render('products/form', { product: req.body, error: 'Lỗi DB: ' + err.message });
  }
});

// Xóa
router.post('/delete', async (req, res) => {
  try {
    if (!req.body.ids) return res.redirect('/products');

    // 1 checkbox gửi lên là chuỗi, nhiều checkbox là mảng -> ép hết về mảng số
    const ids = [].concat(req.body.ids).map(Number).filter(Number.isInteger);
    if (!ids.length) return res.redirect('/products');

    // Lấy ảnh trước khi xóa DB, vì xóa xong là mất thông tin PathImage
    const [rows] = await pool.query('SELECT PathImage FROM Product WHERE ProductID IN (?)', [ids]);
    await pool.query('DELETE FROM Product WHERE ProductID IN (?)', [ids]);
    rows.forEach((r) => removeFile(r.PathImage));

    res.redirect('/products');
  } catch (err) {
    res.status(500).send('Lỗi: ' + err.message);
  }
});

// Sao chép 1 hoặc nhiều
router.post('/copy', async (req, res) => {
  try {
    const ids = [].concat(req.body.ids || []).map(Number).filter(Number.isInteger);
    if (!ids.length) return res.redirect('/products');

    const [rows] = await pool.query('SELECT * FROM Product WHERE ProductID IN (?) ORDER BY ProductID', [ids]);

    for (const p of rows) {
      const newName = p.ProductName + ' (bản sao)';

      // Copy file ảnh sang tên mới (nếu có ảnh)
      let newImage = null;
      if (p.PathImage) {
        const ext = path.extname(p.PathImage);
        const candidate = '/uploads/' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
        try {
          fs.copyFileSync(path.join(__dirname, '..', p.PathImage), path.join(__dirname, '..', candidate));
          newImage = candidate;
        } catch (e) {
          newImage = null; // file gốc mất rồi thì bản sao không có ảnh, không làm hỏng cả đợt copy
        }
      }

      await pool.query(
        `INSERT INTO Product (ProductName, PathImage, ProductType, Quantity, Unit, Price, Description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newName, newImage, p.ProductType, p.Quantity, p.Unit, p.Price, p.Description]
      );
    }

    // Bản sao nằm cuối danh sách (đang xếp ASC), nhảy tới trang cuối cho thấy luôn
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM Product');
    res.redirect('/products?page=' + Math.ceil(total / LIMIT));
  } catch (err) {
    res.status(500).send('Lỗi: ' + err.message);
  }
});

// export dữ liệu ra file Excel hoặc JSON
router.post('/export', async (req, res) => {
  try {
    const ids = [].concat(req.body.ids || []).map(Number).filter(Number.isInteger);
    const cols = 'ProductName, ProductType, Quantity, Unit, Price, Description';
    let rows;

    if (ids.length) {
      // Có chọn: xuất những sản phẩm được chọn
      [rows] = await pool.query(`SELECT ${cols} FROM Product WHERE ProductID IN (?) ORDER BY ProductID`, [ids]);
    } else {
      // Không chọn: xuất tất cả sản phẩm (có thể tìm kiếm)
      const { whereSql, params } = buildSearch((req.body.q || '').trim());
      [rows] = await pool.query(`SELECT ${cols} FROM Product ${whereSql} ORDER BY ProductID`, params);
    }

    rows = rows.map((r) => ({ ...r, Price: Number(r.Price) })); // DECIMAL ra chuỗi, ép về số

    if (req.body.format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="products.json"');
      return res.send(JSON.stringify(rows, null, 2));
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    ws.columns = [
      { header: 'ProductName', key: 'ProductName', width: 36 },
      { header: 'ProductType', key: 'ProductType', width: 18 },
      { header: 'Quantity', key: 'Quantity', width: 10 },
      { header: 'Unit', key: 'Unit', width: 10 },
      { header: 'Price', key: 'Price', width: 12 },
      { header: 'Description', key: 'Description', width: 50 },
    ];
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).send('Lỗi: ' + err.message);
  }
});
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// import dữ liệu từ file Excel hoặc JSON
router.post('/import', memUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.redirect('/products');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const rows = []; // mỗi phần tử: { line: số dòng để báo lỗi, data: object }

    if (ext === '.json') {
      const data = JSON.parse(req.file.buffer.toString('utf8'));
      if (!Array.isArray(data)) throw new Error('File JSON phải là một mảng [ ... ]');
      data.forEach((d, i) => rows.push({ line: i + 1, data: d }));
    } else if (ext === '.xlsx') {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(req.file.buffer);
      const ws = wb.worksheets[0];
      const headers = [];
      ws.getRow(1).eachCell((cell, col) => { headers[col] = cell.text.trim(); });
      ws.eachRow((row, n) => {
        if (n === 1) return; // bỏ dòng tiêu đề
        const obj = {};
        headers.forEach((h, col) => { if (h) obj[h] = row.getCell(col).text; });
        rows.push({ line: n, data: obj });
      });
    } else {
      throw new Error('Chỉ nhận file .xlsx hoặc .json');
    }

    let ok = 0;
    const errors = [];
    for (const { line, data } of rows) {
      // Ép mọi trường về chuỗi cho thống nhất giữa Excel và JSON
      const d = {
        ProductName: String(data.ProductName ?? ''),
        ProductType: String(data.ProductType ?? ''),
        Quantity: String(data.Quantity ?? '0'),
        Unit: String(data.Unit ?? ''),
        Price: String(data.Price ?? '0'),
        Description: String(data.Description ?? ''),
      };

      const errs = validate(d);  // đã có sẵn 1 hàm kiểm tra dữ liệu ở đầu file, dùng lại
      if (errs.length) { errors.push({ line, message: errs.join('. ') }); continue; }

      await pool.query(
        `INSERT INTO Product (ProductName, ProductType, Quantity, Unit, Price, Description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [d.ProductName.trim(), d.ProductType.trim(), Number(d.Quantity), d.Unit.trim(), Number(d.Price), d.Description || null]
      );
      ok++;
    }

    res.render('products/import-result', { ok, errors, fatal: null });
  } catch (err) {
    res.render('products/import-result', { ok: 0, errors: [], fatal: err.message });
  }
});
// Xem chi tiết
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Product WHERE ProductID = ?', [req.params.id]);
    if (!rows.length) return res.status(404).send('Không tìm thấy sản phẩm');
    res.render('products/detail', { product: rows[0] });
  } catch (err) {
    res.status(500).send('Lỗi: ' + err.message);
  }
});

// Form cập nhật
router.get('/:id/edit', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Product WHERE ProductID = ?', [req.params.id]);
    if (!rows.length) return res.status(404).send('Không tìm thấy sản phẩm');
    res.render('products/form', { product: rows[0], error: null });
  } catch (err) {
    res.status(500).send('Lỗi: ' + err.message);
  }
});

// Xử lý cập nhật
router.post('/:id', uploadImage, async (req, res) => {
  const id = req.params.id;
  const errors = validate(req.body);
  if (errors.length) {
    if (req.file) removeFile('/uploads/' + req.file.filename);
    return res.status(400).render('products/form', {
      product: { ...req.body, ProductID: id },
      error: errors.join('. '),
    });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM Product WHERE ProductID = ?', [id]);
    if (!rows.length) {
      if (req.file) removeFile('/uploads/' + req.file.filename);
      return res.status(404).send('Không tìm thấy sản phẩm');
    }
    const old = rows[0];

    const { ProductName, ProductType, Quantity, Unit, Price, Description } = req.body;
    // Có chọn ảnh mới thì dùng ảnh mới, không thì giữ ảnh cũ
    const pathImage = req.file ? '/uploads/' + req.file.filename : old.PathImage;

    await pool.query(
      `UPDATE Product
       SET ProductName = ?, PathImage = ?, ProductType = ?, Quantity = ?, Unit = ?, Price = ?, Description = ?
       WHERE ProductID = ?`,
      [ProductName.trim(), pathImage, ProductType.trim(), Number(Quantity), Unit.trim(), Number(Price), Description || null, id]
    );

    if (req.file) removeFile(old.PathImage); // xóa ảnh cũ cho đỡ rác
    res.redirect('/products/' + id);
  } catch (err) {
    if (req.file) removeFile('/uploads/' + req.file.filename);
    res.status(500).render('products/form', { product: { ...req.body, ProductID: id }, error: 'Lỗi DB: ' + err.message });
  }
});

module.exports = router;