# Smart Pantry System — Hệ thống Quản lý Tủ đồ ăn thông minh bằng AI Vision

[![PlatformIO](https://img.shields.io/badge/PlatformIO-F05032?style=for-the-badge&logo=PlatformIO&logoColor=white)](#)
[![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](#)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](#)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)](#)

> **Một hệ thống IoT từ thiết bị (Edge) đến đám mây (Cloud) tiêu thụ năng lượng cực thấp, tự động theo dõi đồ ăn trong bếp bằng AI Computer Vision và gửi cảnh báo thông minh.**

---

## Tổng quan dự án

**Smart Pantry System** là giải pháp tự động hóa việc quản lý đồ ăn trong gia đình. Các tủ lạnh thông minh hiện nay thường bắt người dùng phải quét mã vạch hoặc nhập tay rất mất thời gian. Dự án này giải quyết vấn đề đó bằng một module **ESP32-CAM** nhỏ gọn gắn trên giá để đồ.

Cách hoạt động cực kỳ đơn giản: Khi có người mở tủ lấy đồ (cảm biến chuyển động PIR phát hiện) hoặc theo lịch trình 1 tiếng/lần, camera sẽ thức dậy từ chế độ **Deep Sleep**, chụp một bức ảnh và gửi về Backend nội bộ (Node.js). Backend sẽ gọi API của **Google Gemini / OpenAI GPT-4V** với các câu lệnh (prompt) phức tạp để nhận diện đồ ăn, ước tính % còn lại trong chai/lọ và cập nhật thẳng lên Firebase Realtime Database. Nếu phát hiện món nào sắp hết, hệ thống sẽ bắn Push Notification (thông báo) ngay lập tức về app điện thoại React Native của người dùng.

---

## Tính năng nổi bật

- Tối ưu năng lượng mức phần cứng (Ultra-Low Power): Vi điều khiển liên tục ngủ sâu (chỉ ăn khoảng `~10µA`) và chỉ bị đánh thức bởi ngắt cứng (Hardware Interrupt) của cảm biến PIR hoặc đồng hồ RTC.
- Xử lý nhiễu ảnh thông minh: Khắc phục lỗi thiếu sáng của cảm biến OV2640 bằng cách tự động xả 2 khung hình đầu tiên (flush PSRAM buffers) để camera kịp điều chỉnh cân bằng trắng (AWB) và tự phơi sáng (AE) trước khi chụp bức ảnh thật.
- Prompt AI theo chuỗi tư duy (Chain-of-Thought): Không cho AI đoán mò % dung tích. Bắt buộc AI phải đưa ra lập luận (soi nắp ở đâu, đáy ở đâu, mức nước ở đâu) trước khi trả về con số JSON.
- Nhận diện với người dùng làm trung tâm (Human-in-the-Loop): Nếu AI thấy một lọ đồ lạ không nhãn mác, nó sẽ đánh dấu lại để người dùng vào App tự định nghĩa (ví dụ: "Đây là lọ muối bột canh"). Từ lần sau, AI sẽ nhớ để nhận diện cho đúng.
- Đồng bộ App & Thông báo thời gian thực: App mobile viết bằng Expo/React Native đồng bộ data trực tiếp qua Firebase, gửi Push Notification báo mua thêm đồ khi đồ ăn dưới mức báo động.

---

## Sơ đồ Kiến trúc Hệ thống

```text
[ESP32-CAM (Thiết bị IoT)] 
       │ 
  (Thức dậy khi có người chuyển động - coi như là lấy nguyên liệu) 
       │
       ▼ (Gửi ảnh Base64 SVGA qua HTTP POST)
       │
[Node.js Express (Local Gateway)] ───► [Gemini/GPT-4V API] (AI phân tích ảnh & tính dung lượng)
       │
       ▼ (Lưu kết quả JSON & Lịch sử)
[Firebase Realtime DB] 
       │
       ▼ (Đồng bộ thời gian thực & Push Notifications qua Expo)
[React Native App]
```

---

## Sơ đồ nối dây (Pinout)

- **Vi điều khiển**: ESP32-CAM (Module AI-Thinker)
- **Cảm biến**: Cảm biến chuyển động PIR HC-SR501

| Chân ESP32-CAM | Chân Linh Kiện | Chức năng |
| :--- | :--- | :--- |
| `3.3V` / `5V` | `VCC` | Cấp nguồn cho cảm biến PIR |
| `GND` | `GND` | Nối đất |
| `GPIO 13` | `OUT` | Tín hiệu PIR (Cấu hình pulldown, dùng làm chân kích hoạt EXT0 Wakeup) |
| `GPIO 4` | Onboard | Đèn LED Flash siêu sáng (Chống nhoè trong tối) |
| `GPIO 33` | Onboard | Đèn LED đỏ báo trạng thái (Active Low) |

---

## Hướng dẫn cài đặt (Getting Started)

### 1. Nạp code Firmware (ESP32-CAM)
1. Cài đặt extension [PlatformIO](https://platformio.org/) trên VS Code.
2. Mở thư mục `/firmware`.
3. Mở file `src/main.cpp`, sửa thông tin WiFi và địa chỉ IP của máy chủ Backend:
   ```cpp
   const char *WIFI_SSID = "TEN_WIFI_CUA_BAN";
   const char *WIFI_PASS = "MAT_KHAU_WIFI";
   const char *SERVER_URL = "http://IP_MANG_LAN_CUA_BAN:3001/api/pantry/capture";
   ```
4. Build và nạp code (Upload) vào ESP32-CAM qua mạch nạp FTDI.

### 2. Chạy Backend (Node.js)
1. Mở terminal tại thư mục `/backend`.
2. Cài đặt thư viện: `npm install`
3. Tạo file `.env` và thêm API key của bạn:
   ```env
   PORT=3001
   GEMINI_API_KEY=api_key_gemini_cua_ban
   OPENAI_API_KEY=api_key_openai_cua_ban (tùy chọn)
   ```
4. Khởi động server: `npm run dev`

### 3. Chạy Mobile App (React Native/Expo)
1. Mở terminal tại thư mục `/mobile`.
2. Cài đặt thư viện: `npm install`
3. Khởi động app: `npx expo start` (Quét mã QR bằng ứng dụng Expo Go trên điện thoại).

---
