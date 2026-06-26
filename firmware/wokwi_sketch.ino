/*
 * Smart Pantry — Wokwi Simulation Sketch (Tối giản)
 * 
 * Phần cứng: ESP32-CAM + PIR HC-SR501 (chỉ 3 dây)
 * Không cần LED strip — phòng bếp đã đủ sáng.
 * 
 * Cách dùng trên wokwi.com:
 * 1. Vào https://wokwi.com/projects/new/esp32
 * 2. Paste nội dung file diagram.json vào tab diagram.json
 * 3. Paste nội dung file này vào tab sketch.ino
 * 4. Bấm ▶ để chạy mô phỏng
 * 5. Click vào PIR sensor để mô phỏng chuyển động
 */

// ==================== CẤU HÌNH PIN ====================
#define PIR_PIN        13   // PIR HC-SR501 OUT → wake source
#define FLASH_LED_PIN  4    // Flash LED onboard (nháy báo hiệu)

// ==================== BIẾN ====================
bool motionDetected = false;
int triggerCount = 0;

// ==================== SETUP ====================
void setup() {
    Serial.begin(115200);
    
    pinMode(PIR_PIN, INPUT);
    pinMode(FLASH_LED_PIN, OUTPUT);
    digitalWrite(FLASH_LED_PIN, LOW);
    
    Serial.println("========================================");
    Serial.println("🍱 Smart Pantry — Tối giản");
    Serial.println("   Phần cứng: ESP32-CAM + PIR (3 dây)");
    Serial.println("========================================");
    Serial.println("");
    Serial.println("📌 Click vào PIR sensor để mô phỏng");
    Serial.println("⏳ Đang chờ chuyển động...");
    Serial.println("");
}

// ==================== LOOP ====================
void loop() {
    int pirState = digitalRead(PIR_PIN);
    
    if (pirState == HIGH && !motionDetected) {
        motionDetected = true;
        triggerCount++;
        
        Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        Serial.printf("👋 [#%d] Phát hiện chuyển động!\n", triggerCount);
        Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        // Nháy flash LED báo hiệu
        Serial.println("  ⚡ Nháy Flash LED onboard...");
        for (int i = 0; i < 2; i++) {
            digitalWrite(FLASH_LED_PIN, HIGH);
            delay(100);
            digitalWrite(FLASH_LED_PIN, LOW);
            delay(100);
        }
        
        // Init Camera + WiFi (giả lập)
        Serial.println("  📶 Kết nối WiFi...");
        delay(1000);
        Serial.println("  ✅ WiFi connected");
        
        Serial.println("  📷 Khởi tạo camera...");
        delay(500);
        Serial.println("  ✅ Camera ready");
        
        // Chụp ảnh
        Serial.println("  📷 Chụp ảnh giá đồ...");
        delay(1000);
        Serial.println("     → Ảnh 640x480 JPEG, ~30KB");
        
        // Gửi ảnh
        Serial.println("  📤 Gửi ảnh → POST /api/pantry/capture");
        delay(1500);
        Serial.println("  ✅ Server: HTTP 200 OK");
        Serial.println("     → AI phân tích: phát hiện 3 món");
        
        // Deep sleep
        Serial.println("");
        Serial.println("  😴 → Deep Sleep (~10μA)");
        Serial.printf("  📊 Tổng: %d lần trigger\n", triggerCount);
        Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        Serial.println("");
        Serial.println("⏳ Click PIR sensor để trigger tiếp...");
        Serial.println("");
        
    } else if (pirState == LOW && motionDetected) {
        motionDetected = false;
    }
    
    delay(100);
}
