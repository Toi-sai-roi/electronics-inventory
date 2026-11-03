USE electronics_inventory;

INSERT INTO Product (ProductName, ProductType, Quantity, Unit, Price, Description) VALUES
('ESP32 DevKit V1', 'Vi điều khiển', 25, 'cái', 95000, 'WiFi + Bluetooth, 30 chân, 3.3V, USB Micro'),
('Arduino Uno R3', 'Vi điều khiển', 15, 'cái', 120000, 'ATmega328P, 5V, 14 chân digital, 6 chân analog'),
('ESP8266 NodeMCU', 'Vi điều khiển', 18, 'cái', 70000, 'WiFi, chip CP2102, 3.3V'),
('Cảm biến nhiệt độ độ ẩm DHT11', 'Cảm biến', 40, 'cái', 25000, 'Đo nhiệt độ 0-50°C, độ ẩm 20-90%, 3.3-5V'),
('Cảm biến khói MQ-2', 'Cảm biến', 12, 'cái', 35000, 'Phát hiện khói, LPG, CO, đầu ra analog và digital, 5V'),
('Cảm biến lửa (Flame sensor)', 'Cảm biến', 20, 'cái', 15000, 'Phát hiện ngọn lửa hồng ngoại, đầu ra digital, 3.3-5V'),
('Cảm biến siêu âm HC-SR04', 'Cảm biến', 30, 'cái', 28000, 'Đo khoảng cách 2-400cm, 5V'),
('Điện trở 10kΩ 1/4W', 'Điện trở', 500, 'cái', 200, 'Sai số 5%, chân cắm'),
('Điện trở 220Ω 1/4W', 'Điện trở', 600, 'cái', 200, 'Sai số 5%, dùng cho LED'),
('Tụ hóa 100µF 25V', 'Tụ điện', 150, 'cái', 1000, 'Tụ điện phân cực, chân cắm'),
('IC khuếch đại LM358', 'IC', 60, 'cái', 5000, 'Op-amp kép, DIP-8, 3-32V'),
('LED đỏ 5mm', 'LED', 300, 'cái', 500, 'LED đỏ 5mm, 2V, 20mA'),
('Relay 5V 1 kênh', 'Module', 22, 'cái', 18000, 'Module relay 1 kênh, 5V, tải 10A 250VAC'),
('Còi buzzer 5V', 'Module', 35, 'cái', 8000, 'Buzzer chủ động, 5V'),
('Dây jumper đực-cái 20cm', 'Phụ kiện', 40, 'bộ', 15000, 'Bộ 40 sợi nhiều màu'),
('Breadboard 830 lỗ', 'Phụ kiện', 14, 'cái', 35000, 'Board test mạch 830 điểm');