require('dotenv').config(); // Tải biến môi trường từ file .env
const express = require('express'); // Tải thư viện Express
const path = require('path'); // Tải thư viện path để xử lý đường dẫn

const app = express();  // Khởi tạo ứng dụng Express

app.set('view engine', 'ejs'); // Thiết lập EJS làm view engine
app.set('views', path.join(__dirname, 'views')); // Thiết lập thư mục chứa các file view
app.use(express.urlencoded({ extended: true })); // Thiết lập middleware để phân tích dữ liệu từ form gửi lên
app.use(express.json()); // Thiết lập middleware để phân tích dữ liệu JSON
app.use(express.static(path.join(__dirname, 'public'))); // Thiết lập thư mục public để phục vụ các tệp tĩnh
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Thiết lập đường dẫn cho các tệp được tải lên

app.get('/', (req, res) => res.redirect('/products')); // Khi truy cập vào trang chủ, chuyển hướng đến trang /products
app.use('/products', require('./routes/products')); // Sử dụng router cho các đường dẫn bắt đầu bằng /products, được định nghĩa trong file routes/products.js

// Khởi động server và lắng nghe trên cổng được chỉ định trong biến môi trường PORT
app.listen(process.env.PORT, () => {
  console.log('Server chạy tại http://localhost:' + process.env.PORT);
});