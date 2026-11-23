# Electronics Inventory

Ứng dụng web quản lý kho linh kiện điện tử, tích hợp AI (OCR đọc nhãn/hóa đơn và Chatbot tư vấn linh kiện).

## **Cài đặt**

1. Cài đặt **Node.js** và **MySQL** (có thể sử dụng XAMPP).
2. Cài đặt dependencies:
   ```sh
   npm i
   ```
3. Import file `schema.sql` vào MySQL để tạo database và các bảng.

Nếu muốn có sẵn dữ liệu mẫu (16 linh kiện), hãy import thêm file `seed.sql`.

4. Sao chép `.env.example` thành `.env`, sau đó điền thông tin kết nối database và `GEMINI_API_KEY`.
5. Chạy ứng dụng:

```sh
npm run dev
```

6. Mở trình duyệt và truy cập:

```text
http://localhost:3000
```

## **Cấu hình AI**

- `GEMINI_API_KEY`: Bắt buộc để sử dụng OCR và Chatbot. Lấy API key tại Google AI Studio.
- `GEMINI_MODEL`: Model chính (mặc định `gemini-3.5-flash-lite`).
- `GEMINI_FALLBACK_MODEL`: Model dự phòng khi model chính quá tải (`503`).

> **Lưu ý:** Ứng dụng sử dụng Gemini Free Tier nên có giới hạn số request mỗi phút. Các lỗi `503` (server Google quá tải) hoặc `429` (vượt hạn mức request) có thể xảy ra. Ứng dụng đã tích hợp model dự phòng để xử lý trường hợp model chính gặp sự cố.

## **Tính năng chính**

### **1. Quản lý sản phẩm**

- Thêm, xem chi tiết, chỉnh sửa, xóa và sao chép sản phẩm.
- Hỗ trợ xóa và sao chép một hoặc nhiều sản phẩm cùng lúc.
- Tìm kiếm bằng một ô duy nhất, cho phép dò tìm trên tất cả các cột.
- Phân trang với tùy chọn số dòng hiển thị trên mỗi trang.
- Hỗ trợ cả phân trang phía FE (trình duyệt) và BE (server).
- Tải ảnh sản phẩm lên.
- Nhập dữ liệu từ Excel/JSON và xuất dữ liệu ra Excel/JSON.
- Ẩn/hiện các cột trong bảng; lựa chọn được lưu trên trình duyệt.
- Hỗ trợ phím tắt `Alt + chữ` cho các thao tác chính:

  - `Alt + N`: Thêm mới.
  - `Alt + S`: Lưu.
  - `Alt + H`: Hủy/Quay lại.

### **2. AI - OCR đọc thông tin sản phẩm**

- Tích hợp nút **"Đọc thông tin từ ảnh (AI)"** trên form thêm/sửa sản phẩm.
- Sử dụng Gemini Vision để đọc thông tin từ ảnh nhãn linh kiện hoặc hóa đơn.
- Tự động nhận diện và điền các trường thông tin sản phẩm.
- Hỗ trợ nút **Hoàn tác** để khôi phục dữ liệu trước khi AI điền thông tin.

### **3. AI - Chatbot tư vấn linh kiện**

- Tích hợp khung chat **"Hỏi kho"** ngay trên trang danh sách sản phẩm.
- Sử dụng Gemini Function Calling để truy vấn dữ liệu thông qua các hàm có sẵn:

  - `search_products`
  - `list_products`
  - `low_stock`
  - `list_types`
  - `inventory_summary`
  - `find_anomalies`

- AI không trực tiếp viết hoặc thực thi câu lệnh SQL.
- Số liệu kho được lấy từ kết quả các hàm truy vấn và kiểm tra bằng code, không phụ thuộc vào nội dung do model tự trả lời.
- Lịch sử trò chuyện được lưu trên trình duyệt bằng `localStorage`.
- Hỗ trợ nút **Xóa chat** để xóa lịch sử trò chuyện.

## **Các form**

Ứng dụng hiện có 3 form chính:

1. Danh sách sản phẩm.
2. Xem chi tiết sản phẩm.
3. Thêm/Sửa sản phẩm.

## **Ghi chú cấu hình**

Các giá trị trong `.env.example` giả định MySQL đang chạy trên máy cục bộ với cấu hình mặc định của XAMPP:

- Username: `root`
- Password: Để trống.

Nếu cấu hình MySQL trên máy của bạn khác với mặc định trên, hãy chỉnh sửa lại thông tin kết nối trong file `.env` cho phù hợp.