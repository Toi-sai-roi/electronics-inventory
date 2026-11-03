# Electronics Inventory

Ứng dụng web quản lý kho linh kiện điện tử, hỗ trợ quản lý thông tin, số lượng, giá và ảnh sản phẩm.

## Cài đặt

1. Cài Node.js và MySQL (có thể dùng XAMPP).
2. Cài dependencies:
   ```sh
   npm i
   ```
3. Import `schema.sql` vào MySQL để tạo database và bảng. Muốn có sẵn dữ liệu mẫu thì import thêm `seed.sql`.
4. Sao chép `.env.example` thành `.env`, rồi chỉnh thông tin kết nối nếu cần.
5. Chạy ứng dụng:
   ```sh
   npm run dev
   ```
6. Mở `http://localhost:3000`.

## Tính năng chính

- Thêm, xem, sửa, xóa và sao chép sản phẩm (xóa và sao chép chọn được 1 hoặc nhiều dòng).
- Tìm kiếm 1 ô duy nhất (dò mọi cột) và phân trang.
- Tải ảnh sản phẩm lên.
- Nhập dữ liệu từ Excel/JSON và xuất Excel/JSON.
- Ẩn/hiện cột của bảng, lựa chọn được ghi nhớ trên trình duyệt.
- Phím tắt Alt + chữ cho các thao tác chính (Alt+N thêm mới, Alt+S lưu, Alt+H hủy/quay lại...).

## Ghi chú cấu hình

Giá trị trong `.env.example` giả định MySQL chạy trên máy cục bộ với tài khoản XAMPP mặc định `root` không có mật khẩu. Hãy đổi nếu cấu hình MySQL của bạn khác.