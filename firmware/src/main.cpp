/*
 * Smart Pantry — ESP32-CAM Firmware (Deep Sleep FSM)
 * Board: ESP32-CAM Generic (tương thích AI-Thinker pinout)
 *
 * Chức năng:
 * - Tiết kiệm điện năng tối đa, hoạt động dựa trên Deep Sleep
 * - Wake up bởi 2 nguồn:
 *   1. PIR Sensor (GPIO 13): Bắt chuyển động, chụp ảnh, rồi ngủ tiếp. Sau khi chụp đặt timer 1h.
 *   2. Timer (RTC): Hết 1h không có PIR, thức dậy chụp 1 ảnh snapshot báo cáo, rồi ngủ tiếp, không đặt timer nữa.
 */

#include "driver/rtc_io.h"
#include "esp_camera.h"
#include "esp_sleep.h"
#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>

// ==================== CẤU HÌNH ====================
// WiFi
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Backend server
const char *SERVER_URL = "http://YOUR_LAN_IP:3001/api/pantry/capture";
const char *STATUS_URL = "http://YOUR_LAN_IP:3001/api/pantry/device";
const char *DEVICE_ID = "device_001";
const char *FAMILY_ID = "family_001";

// Pin assignments
#define PIR_PIN GPIO_NUM_13      // PIR HC-SR501 OUT → wake source
#define FLASH_LED_PIN GPIO_NUM_4 // Onboard flash LED
#define RED_LED_PIN GPIO_NUM_33  // Onboard red LED

// Timing
#define SNAPSHOT_INTERVAL_US 3600000000ULL // 1 giờ = 3600 giây = 3.6 tỷ microseconds
#define CAPTURE_DELAY_MS 2000              // Đợi 2s sau khi PIR trigger để người lấy đồ xong
#define WIFI_TIMEOUT_MS 15000              // Timeout kết nối WiFi
#define SERVER_TIMEOUT_MS 30000            // Timeout gửi ảnh

// Camera pins
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

// ==================== BIẾN TOÀN CỤC (LƯU TRONG RTC) ====================

RTC_DATA_ATTR int wakeCount = 0;  // Đếm số lần thức dậy
RTC_DATA_ATTR int photoCount = 0; // Đếm số ảnh đã chụp

// ==================== KHỞI TẠO CAMERA ====================

bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_SVGA; // 800x600
    config.jpeg_quality = 12; 
    config.fb_count = 2; // Dùng 2 buffer để xả frame cho ảnh sáng
  } else {
    config.frame_size = FRAMESIZE_VGA; 
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }
  config.grab_mode = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ Camera init failed: 0x%x\n", err);
    return false;
  }

  // Điều chỉnh sensor
  sensor_t *s = esp_camera_sensor_get();
  s->set_brightness(s, 1);
  s->set_contrast(s, 1);
  s->set_saturation(s, 0);
  s->set_whitebal(s, 1);
  s->set_awb_gain(s, 1);
  s->set_aec2(s, 1);
  s->set_gainceiling(s, GAINCEILING_8X);

  Serial.println("✅ Camera initialized");
  return true;
}

// ==================== KẾT NỐI WIFI ====================

bool connectWiFi() {
  Serial.printf("📶 Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - startTime > WIFI_TIMEOUT_MS) {
      Serial.println("\n❌ WiFi connection timeout!");
      return false;
    }
  }

  Serial.printf("\n✅ WiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
  return true;
}

// ==================== BASE64 ENCODING ====================

static const char base64_chars[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

String base64Encode(const uint8_t *data, size_t length) {
  String encoded = "";
  encoded.reserve(((length + 2) / 3) * 4);

  int i = 0;
  uint8_t byte3[3];
  uint8_t byte4[4];

  while (length--) {
    byte3[i++] = *(data++);
    if (i == 3) {
      byte4[0] = (byte3[0] & 0xfc) >> 2;
      byte4[1] = ((byte3[0] & 0x03) << 4) + ((byte3[1] & 0xf0) >> 4);
      byte4[2] = ((byte3[1] & 0x0f) << 2) + ((byte3[2] & 0xc0) >> 6);
      byte4[3] = byte3[2] & 0x3f;

      for (i = 0; i < 4; i++)
        encoded += base64_chars[byte4[i]];
      i = 0;
    }
  }

  if (i) {
    for (int j = i; j < 3; j++)
      byte3[j] = '\0';

    byte4[0] = (byte3[0] & 0xfc) >> 2;
    byte4[1] = ((byte3[0] & 0x03) << 4) + ((byte3[1] & 0xf0) >> 4);
    byte4[2] = ((byte3[1] & 0x0f) << 2) + ((byte3[2] & 0xc0) >> 6);
    byte4[3] = byte3[2] & 0x3f;

    for (int j = 0; j < (i + 1); j++)
      encoded += base64_chars[byte4[j]];

    while (i++ < 3)
      encoded += '=';
  }

  return encoded;
}

// ==================== CHỤP ẢNH & GỬI ====================

bool captureAndSend(const char *wakeReason) {
  Serial.println("📷 Capturing photo...");

  // Bật đèn Flash onboard (GPIO 4)
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(200); // Chờ sensor điều chỉnh phơi sáng

  // Xả khung hình cũ trong buffer
  camera_fb_t *fb = NULL;
  for (int i = 0; i < 2; i++) {
    fb = esp_camera_fb_get();
    if (fb)
      esp_camera_fb_return(fb);
  }

  // Chụp Frame thật sự
  fb = esp_camera_fb_get();
  
  // Tắt Flash
  digitalWrite(FLASH_LED_PIN, LOW);

  if (!fb) {
    Serial.println("❌ Camera capture failed!");
    return false;
  }

  Serial.printf("📷 Photo captured: %d bytes (%dx%d)\n", fb->len, fb->width, fb->height);
  photoCount++;

  // Encode base64
  Serial.println("🔄 Encoding base64...");
  String base64Image = base64Encode(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  Serial.printf("📤 Sending to server (%d bytes base64)...\n", base64Image.length());

  // Gửi HTTP POST
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(SERVER_TIMEOUT_MS);

  // Build JSON payload
  String jsonPayload;
  jsonPayload.reserve(base64Image.length() + 256);
  jsonPayload = "{";
  jsonPayload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  jsonPayload += "\"familyId\":\"" + String(FAMILY_ID) + "\",";
  jsonPayload += "\"motionEvent\":\"motion_detected\",";
  jsonPayload += "\"wakeReason\":\"" + String(wakeReason) + "\",";
  jsonPayload += "\"wakeCount\":" + String(wakeCount) + ",";
  jsonPayload += "\"photoCount\":" + String(photoCount) + ",";
  jsonPayload += "\"imageBase64\":\"" + base64Image + "\"";
  jsonPayload += "}";

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    Serial.printf("✅ Server response: %d\n", httpCode);
  } else {
    Serial.printf("❌ HTTP error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return httpCode == 200;
}

// ==================== GỬI IP CAMERA LÊN BACKEND ====================

void reportCameraIp() {
  Serial.println("📤 Reporting camera IP to backend...");
  HTTPClient http;
  String baseUrl = String("http://YOUR_LAN_IP:3001/api/pantry/device/") + String(DEVICE_ID) + "/ip";
  http.begin(baseUrl);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  
  String json = "{\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  int httpCode = http.PUT(json);
  
  if (httpCode > 0) {
    Serial.printf("✅ Camera IP reported: %d\n", httpCode);
  }
  http.end();
}

// ==================== SETUP (CHẠY MỖI KHI THỨC DẬY) ====================

void setup() {
  Serial.begin(115200);
  delay(100);

  wakeCount++;

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);
  pinMode(RED_LED_PIN, OUTPUT);
  digitalWrite(RED_LED_PIN, HIGH); // Tắt LED đỏ
  
  // cấu hình chân PIR thành INPUT với PULLDOWN hoặc external pulldown
  pinMode(PIR_PIN, INPUT);

  Serial.println("\n========================================");
  Serial.println("🍱 Smart Pantry — Deep Sleep Mode");
  Serial.printf("   Wake #%d | Photos: %d\n", wakeCount, photoCount);

  // 1. KIỂM TRA NGUYÊN NHÂN THỨC DẬY
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  String wakeReasonStr = "power_on";
  bool setupTimer = false;

  switch(wakeup_reason) {
    case ESP_SLEEP_WAKEUP_EXT0:
      Serial.println("👋 Wakeup caused by PIR Sensor!");
      wakeReasonStr = "pir";
      // Bật LED đỏ báo hiệu đã nhận biết chuyển động
      digitalWrite(RED_LED_PIN, LOW); 
      Serial.println("⏳ Waiting 2s for person to finish interacting...");
      delay(CAPTURE_DELAY_MS);
      digitalWrite(RED_LED_PIN, HIGH);
      // Có PIR → Đặt timer cho lần sau
      setupTimer = true; 
      break;

    case ESP_SLEEP_WAKEUP_TIMER:
      Serial.println("⏱️ Wakeup caused by Timer (1 hour snapshot)!");
      wakeReasonStr = "timer_snapshot";
      // Đã chụp ảnh timer rồi thì không đặt timer tiếp, chỉ chờ PIR
      setupTimer = false;
      break;

    default:
      Serial.printf("🔌 Wakeup caused by reset or power-on (%d)\n", wakeup_reason);
      wakeReasonStr = "power_on";
      // Power on → Chụp khởi tạo rồi đặt timer 1 tiếng
      setupTimer = true;
      break;
  }

  // 2. KHỞI TẠO CAMERA & WIFI (chỉ khi cần chụp ảnh)
  if (initCamera()) {
    if (connectWiFi()) {
      // 3. CHỤP VÀ GỬI ẢNH
      captureAndSend(wakeReasonStr.c_str());
      
      // Báo IP
      reportCameraIp();
    } else {
      Serial.println("❌ Could not connect to WiFi. Skipping capture.");
    }
  }

  // 4. ENTER DEEP SLEEP
  Serial.println("😴 Entering Deep Sleep...");
  Serial.flush();

  // Luôn luôn cấu hình thức dậy bằng PIR
  esp_sleep_enable_ext0_wakeup(PIR_PIN, 1); // 1 = High, gửi tín hiệu cho ESP32

  // Nếu vừa được kích hoạt bởi PIR hoặc Power On, đặt thêm Timer 1 tiếng
  if (setupTimer) {
    Serial.println("⏱️ Setting 1-hour snapshot timer.");
    esp_sleep_enable_timer_wakeup(SNAPSHOT_INTERVAL_US);
  } else {
    Serial.println("👁️ Only PIR will wake me up next.");
  }

  // Ngắt kết nối WiFi cho an toàn
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);

  // Tắt Flash lần cuối
  digitalWrite(FLASH_LED_PIN, LOW);

  // Ngủ sâu
  esp_deep_sleep_start();
}
