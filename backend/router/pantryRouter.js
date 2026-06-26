const express = require('express');
const axios = require('axios');
const router = express.Router();
const db = require('../config/firebaseConfig');
const { Expo } = require('expo-server-sdk');
const { analyzeImage, getItemContext } = require('../services/visionService');
const { updateInventoryFromAI } = require('../services/inventoryService');

let expo = new Expo();

/**
 * Pantry Router — Nhận ảnh từ ESP32-CAM, xử lý sự kiện phát hiện chuyển động tại giá đồ
 */

// ESP32-CAM gửi ảnh lên (POST base64 image)
router.post('/capture', async (req, res) => {
    try {
        const { deviceId, familyId, imageBase64, motionEvent, wakeReason, cameraIp } = req.body;

        let base64 = imageBase64;
        
        // NẾU LỆNH TỪ APP (không có base64), BACKEND TỰ VÀO CAMERA LẤY ẢNH
        if (!base64 && cameraIp) {
            console.log(`📥 Lệnh từ App: Đang tải ảnh trực tiếp từ Camera IP ${cameraIp}...`);
            const response = await axios.get(`http://${cameraIp}/cam`, { responseType: 'arraybuffer', timeout: 20000 });
            base64 = Buffer.from(response.data).toString('base64');
            console.log(`✅ Đã tải xong ảnh từ Camera. Length: ${base64.length}, Start: ${base64.substring(0, 50)}`);
        }

        if (!base64) {
            return res.status(400).json({ success: false, message: 'Cần có imageBase64 hoặc cameraIp.' });
        }

        console.log(`📷 Received image from device: ${deviceId}, event: ${motionEvent}, wake: ${wakeReason || 'unknown'}`);

        // 1. Lấy context (danh sách item đã biết) để AI nhận diện chính xác hơn
        const context = await getItemContext(familyId || 'default');
        console.log(`📋 Context loaded: ${context.definitions.length} definitions, ${context.inventory.length} inventory items`);

        // 2. Phân tích ảnh bằng AI (có context)
        const aiResult = await analyzeImage(base64, context);
        console.log(`🤖 AI detected ${(aiResult.items || []).length} items`);

        // 3. Kiểm tra và lưu vật thể cần định nghĩa
        const undefinedItems = (aiResult.items || []).filter(item => item.needsDefinition);
        if (undefinedItems.length > 0) {
            console.log(`🔔 ${undefinedItems.length} items need user definition`);
        }

        // 4. Tiết kiệm storage: Xoá ảnh cũ trong cùng session PIR
        // Nếu có ảnh PIR trước đó trong vòng 5 phút từ cùng thiết bị, xoá base64 của ảnh cũ
        // → Chỉ giữ lại ảnh cuối cùng của mỗi session
        if (wakeReason === 'pir' || motionEvent === 'motion_detected') {
            const SESSION_WINDOW_MS = 5 * 60 * 1000; // 5 phút
            const sessionStart = new Date(Date.now() - SESSION_WINDOW_MS).toISOString();
            
            try {
                const recentSnap = await db.ref('activity_logs')
                    .orderByChild('timestamp')
                    .startAt(sessionStart)
                    .once('value');
                
                const keysToClean = [];
                recentSnap.forEach(child => {
                    const log = child.val();
                    if (log.deviceId === (deviceId || 'unknown') &&
                        log.familyId === (familyId || 'default') &&
                        log.triggerType === 'pir' &&
                        log.imageBase64 && log.imageBase64.length > 200) {
                        keysToClean.push(child.key);
                    }
                });

                if (keysToClean.length > 0) {
                    console.log(`🗑️ Cleaning ${keysToClean.length} old PIR photos from same session (keeping only latest)`);
                    for (const key of keysToClean) {
                        await db.ref(`activity_logs/${key}/imageBase64`).remove();
                    }
                }
            } catch (err) {
                console.error('⚠️ Session cleanup error (non-critical):', err.message);
            }
        }

        // 5. Lưu ảnh mới + log vào Firebase
        const logRef = db.ref('activity_logs').push();
        const logData = {
            familyId: familyId || 'default',
            deviceId: deviceId || 'unknown',
            timestamp: new Date().toISOString(),
            eventType: motionEvent || 'motion_detected',
            triggerType: wakeReason || 'pir',
            imageBase64: base64, // Lưu full base64 — ảnh cũ trong session đã bị xoá ở trên
            detectedItems: (aiResult.items || []).map(i => i.name),
            action: aiResult.action || 'unknown',
            aiAnalysis: aiResult.summary || '',
            aiProvider: aiResult.provider || 'unknown',
            fullAiResult: aiResult,
            hasUndefinedItems: undefinedItems.length > 0
        };
        await logRef.set(logData);

        // 5. Lưu undefined items vào node riêng để app hiển thị
        // Tránh trùng lặp: Xóa các cảnh báo cũ chưa định nghĩa trước khi thêm mới
        if (undefinedItems.length > 0) {
            const undefinedPath = `undefined_items/${familyId || 'default'}`;
            const existingRef = db.ref(undefinedPath);
            const snapshot = await existingRef.orderByChild('defined').equalTo(false).once('value');
            if (snapshot.exists()) {
                const updates = {};
                snapshot.forEach(child => {
                    updates[child.key] = null;
                });
                await existingRef.update(updates);
            }
        }

        for (let i = 0; i < undefinedItems.length; i++) {
            const item = undefinedItems[i];
            const undefinedRef = db.ref(`undefined_items/${familyId || 'default'}`).push();
            await undefinedRef.set({
                logId: logRef.key,
                itemIndex: i,
                originalName: item.name,
                originalNameEn: item.nameEn || '',
                description: item.description || '',
                category: item.category || 'khac',
                estimatedPercent: typeof item.estimatedPercent === 'number' ? item.estimatedPercent : 100,
                estimatedQuantity: item.estimatedQuantity || '',
                boundingBox: item.boundingBox || null,
                imageBase64: imageBase64, // Lưu ảnh để user xem
                timestamp: new Date().toISOString(),
                defined: false // Chưa được người dùng định nghĩa
            });
        }

        // 6. Cập nhật inventory dựa trên AI result (chỉ những item ĐÃ nhận diện được)
        let inventoryUpdates = [];
        const identifiedItems = (aiResult.items || []).filter(item => !item.needsDefinition);
        
        // Nếu là bấm nút "Phân tích" trên App, tự động coi là quét toàn bộ kho (put_in)
        if (wakeReason === 'manual_capture' && aiResult.action === 'just_checking') {
            aiResult.action = 'put_in';
        }

        if (identifiedItems.length > 0 && aiResult.action !== 'just_checking') {
            inventoryUpdates = await updateInventoryFromAI(
                familyId || 'default',
                aiResult,
                wakeReason,
                logRef.key
            );

            // ==================== CHECK THRESHOLDS & SEND PUSH NOTIFICATION ====================
            // Phân loại: Xanh (>60), Vàng (30-60), Đỏ (0-30)
            const redItems = inventoryUpdates.filter(u => u.remainingPercent <= 30);
            const yellowItems = inventoryUpdates.filter(u => u.remainingPercent > 30 && u.remainingPercent <= 60);

            if (redItems.length > 0 || yellowItems.length > 0) {
                // Fetch push tokens
                const tokenSnap = await db.ref(`push_tokens/${familyId || 'default'}`).once('value');
                if (tokenSnap.exists()) {
                    const messages = [];
                    const redNames = redItems.map(i => i.name).join(', ');
                    const yellowNames = yellowItems.map(i => i.name).join(', ');
                    
                    let bodyStr = '';
                    if (redItems.length > 0) {
                        bodyStr += `${redNames} của bạn sắp hết cần phải đi mua. `;
                    }
                    if (yellowItems.length > 0) {
                        bodyStr += `Có thể mua thêm ${yellowNames} vì cũng có nguy cơ hết mấy ngày tới.`;
                    }

                    tokenSnap.forEach(child => {
                        const pushToken = child.val().token;
                        if (Expo.isExpoPushToken(pushToken)) {
                            messages.push({
                                to: pushToken,
                                sound: 'default',
                                title: 'Cảnh báo hết nguyên liệu ⚠️',
                                body: bodyStr.trim(),
                                data: { type: 'inventory_alert' },
                            });
                        }
                    });

                    if (messages.length > 0) {
                        try {
                            let chunks = expo.chunkPushNotifications(messages);
                            for (let chunk of chunks) {
                                await expo.sendPushNotificationsAsync(chunk);
                            }
                            console.log(`📤 Đã gửi push notification: ${bodyStr}`);
                        } catch (e) {
                            console.error('❌ Lỗi gửi push notification:', e);
                        }
                    }
                }
            }
        }

        // 4. Cập nhật device info
        if (deviceId) {
            await db.ref(`pantry_device/${deviceId}`).update({
                lastActive: new Date().toISOString(),
                lastMotionDetected: new Date().toISOString(),
                photoCount: (await db.ref(`pantry_device/${deviceId}/photoCount`).once('value')).val() + 1 || 1
            });
        }

        res.json({
            success: true,
            logId: logRef.key,
            aiResult: {
                provider: aiResult.provider,
                itemCount: (aiResult.items || []).length,
                items: aiResult.items,
                summary: aiResult.summary,
                action: aiResult.action,
                undefinedCount: undefinedItems.length
            },
            inventoryUpdates,
            message: undefinedItems.length > 0 
                ? `Phân tích xong. Có ${undefinedItems.length} vật thể cần bạn định nghĩa.`
                : 'Ảnh đã được phân tích và cập nhật inventory.'
        });

    } catch (error) {
        console.error('❌ Pantry capture error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy activity logs
router.get('/logs/:familyId', async (req, res) => {
    try {
        const snapshot = await db.ref('activity_logs')
            .orderByChild('familyId')
            .equalTo(req.params.familyId)
            .once('value');

        const logs = [];
        snapshot.forEach(child => {
            const log = child.val();
            // Don't return full base64 image in list
            delete log.imageBase64;
            delete log.fullAiResult;
            logs.push({ id: child.key, ...log });
        });

        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const limit = parseInt(req.query.limit) || 50;

        res.json({ success: true, count: logs.length, data: logs.slice(0, limit) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy chi tiết 1 log (bao gồm AI result đầy đủ)
router.get('/logs/detail/:logId', async (req, res) => {
    try {
        const snapshot = await db.ref(`activity_logs/${req.params.logId}`).once('value');
        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Log không tồn tại.' });
        }
        res.json({ success: true, data: { id: req.params.logId, ...snapshot.val() } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy trạng thái thiết bị pantry
router.get('/device/:deviceId', async (req, res) => {
    try {
        const snapshot = await db.ref(`pantry_device/${req.params.deviceId}`).once('value');
        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại.' });
        }
        res.json({ success: true, data: { id: req.params.deviceId, ...snapshot.val() } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Đăng ký thiết bị pantry mới
router.post('/device', async (req, res) => {
    try {
        const { familyId, name } = req.body;
        const newRef = db.ref('pantry_device').push();
        await newRef.set({
            familyId: familyId || 'default',
            name: name || 'Pantry Cam - Giá bếp',
            status: 'deep_sleep',
            lastActive: new Date().toISOString(),
            lastMotionDetected: null,
            triggerCount: 0,
            photoCount: 0,
            wakeCount: 0,
            createdAt: new Date().toISOString()
        });
        res.json({ success: true, deviceId: newRef.key, message: 'Đăng ký thiết bị thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== GALLERY — Xem lại ảnh đã chụp ====================

// Lấy danh sách ảnh cho gallery (có kèm base64 thumbnail)
router.get('/gallery/:familyId', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const snapshot = await db.ref('activity_logs')
            .orderByChild('familyId')
            .equalTo(req.params.familyId)
            .once('value');

        const photos = [];
        snapshot.forEach(child => {
            const log = child.val();
            if (log.imageBase64 && log.imageBase64.length > 200) {
                photos.push({
                    id: child.key,
                    timestamp: log.timestamp,
                    deviceId: log.deviceId,
                    triggerType: log.triggerType,
                    detectedItems: log.detectedItems || [],
                    action: log.action,
                    aiAnalysis: log.aiAnalysis || '',
                    imageBase64: log.imageBase64,
                });
            }
        });

        photos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ success: true, count: photos.length, data: photos.slice(0, limit) });
    } catch (error) {
        console.error('❌ Gallery error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy ảnh từ activity log
router.get('/image/:logId', async (req, res) => {
    try {
        const snapshot = await db.ref(`activity_logs/${req.params.logId}`).once('value');
        const log = snapshot.val();

        if (!log || !log.imageBase64) {
            return res.status(404).json({ success: false, message: 'Image not found' });
        }

        // Convert base64 to binary and send as JPEG
        const buffer = Buffer.from(log.imageBase64, 'base64');
        res.set('Content-Type', 'image/jpeg');
        res.set('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        console.error('❌ Get image error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy log mới nhất
router.get('/latest/:familyId', async (req, res) => {
    try {
        const snapshot = await db.ref('activity_logs')
            .orderByChild('familyId')
            .equalTo(req.params.familyId)
            .limitToLast(1)
            .once('value');

        const log = [];
        snapshot.forEach(child => {
            const item = child.val();
            delete item.imageBase64;
            delete item.fullAiResult;
            log.push({ id: child.key, ...item });
        });

        res.json({ success: true, log: log[0] || null });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== CAMERA IP UPDATE ====================

// ESP32-CAM gửi IP lên sau khi kết nối WiFi
router.put('/device/:deviceId/ip', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { ip } = req.body;

        if (!ip) {
            return res.status(400).json({ success: false, message: 'Cần có ip.' });
        }

        const cameraStreamUrl = `http://${ip}/stream`;
        const cameraFrameUrl = `http://${ip}/cam`;

        await db.ref(`pantry_device/${deviceId}`).update({
            cameraIp: ip,
            cameraStreamUrl,
            cameraFrameUrl,
            lastIpUpdate: new Date().toISOString(),
            status: 'online'
        });

        console.log(`📹 Device ${deviceId} camera IP updated: ${ip}`);

        res.json({
            success: true,
            message: `Camera IP updated to ${ip}`,
            data: { cameraIp: ip, cameraStreamUrl, cameraFrameUrl }
        });
    } catch (error) {
        console.error('❌ Update camera IP error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Proxy: lấy 1 frame JPEG từ ESP32-CAM (dùng khi app khác mạng, backend cùng mạng)
router.get('/device/:deviceId/camera-frame', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const snapshot = await db.ref(`pantry_device/${deviceId}`).once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại.' });
        }

        const device = snapshot.val();
        if (!device.cameraIp) {
            return res.status(404).json({ success: false, message: 'Camera IP chưa được cập nhật.' });
        }

        const frameUrl = `http://${device.cameraIp}/cam`;
        console.log(`📹 Proxying camera frame from: ${frameUrl}`);

        const response = await axios.get(frameUrl, {
            responseType: 'arraybuffer',
            timeout: 10000
        });

        res.set('Content-Type', 'image/jpeg');
        res.set('Content-Length', response.data.length);
        res.send(Buffer.from(response.data));
    } catch (error) {
        console.error('❌ Camera frame proxy error:', error.message);
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                success: false,
                message: 'Không thể kết nối đến camera. Thiết bị có thể đang offline.'
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== HUMAN-IN-THE-LOOP: Định nghĩa vật thể lạ ====================

// Người dùng định nghĩa một vật thể mà AI không nhận diện được
router.post('/define-item', async (req, res) => {
    try {
        const { familyId, undefinedItemId, name, category, description } = req.body;

        if (!familyId || !undefinedItemId || !name) {
            return res.status(400).json({
                success: false,
                message: 'Cần có familyId, undefinedItemId, và name.'
            });
        }

        // 1. Lấy thông tin undefined item
        const undefinedSnap = await db.ref(`undefined_items/${familyId}/${undefinedItemId}`).once('value');
        if (!undefinedSnap.exists()) {
            return res.status(404).json({ success: false, message: 'Vật thể không tồn tại.' });
        }

        const undefinedItem = undefinedSnap.val();

        // 2. Lưu định nghĩa vào item_definitions (để AI tra cứu lần sau)
        const defRef = db.ref(`item_definitions/${familyId}`).push();
        await defRef.set({
            name: name.trim(),
            category: category || undefinedItem.category || 'khac',
            description: description || undefinedItem.description || '',
            originalAiName: undefinedItem.originalName,
            definedAt: new Date().toISOString(),
            definedBy: 'user'
        });

        // 3. Tự động thêm vào inventory
        let percent = 100;
        if (typeof undefinedItem.estimatedPercent === 'number') {
            percent = Math.min(100, Math.max(0, undefinedItem.estimatedPercent));
        } else if (undefinedItem.condition) {
            // Fallback
            if (undefinedItem.condition === 'empty') percent = 0;
            else if (undefinedItem.condition === 'low') percent = 25;
            else if (undefinedItem.condition === 'ok') percent = 75;
        }

        const invRef = db.ref('inventory').push();
        await invRef.set({
            familyId,
            name: name.trim(),
            nameEn: undefinedItem.originalNameEn || '',
            category: category || undefinedItem.category || 'khac',
            unit: undefinedItem.estimatedQuantity || 'phần',
            initialQuantity: 1,
            remainingPercent: percent,
            estimatedUsagePerMeal: 1,
            totalUsageCount: 0,
            totalMealsEstimate: 10,
            addedAt: new Date().toISOString(),
            lastUsedAt: null,
            estimatedEmptyDate: null,
            status: percent <= 0 ? 'empty' : percent <= 25 ? 'low' : percent <= 75 ? 'ok' : 'full'
        });

        // 4. Đánh dấu undefined item đã được định nghĩa
        await db.ref(`undefined_items/${familyId}/${undefinedItemId}`).update({
            defined: true,
            definedName: name.trim(),
            definedAt: new Date().toISOString()
        });

        console.log(`✅ User defined item: "${undefinedItem.originalName}" → "${name.trim()}"`);

        res.json({
            success: true,
            message: `Đã lưu "${name.trim()}" vào hệ thống. AI sẽ nhận diện đúng từ lần sau!`,
            definitionId: defRef.key,
            inventoryId: invRef.key
        });

    } catch (error) {
        console.error('❌ Define item error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy danh sách vật thể chờ người dùng định nghĩa
router.get('/undefined-items/:familyId', async (req, res) => {
    try {
        const snapshot = await db.ref(`undefined_items/${req.params.familyId}`)
            .orderByChild('defined')
            .equalTo(false)
            .once('value');

        const items = [];
        snapshot.forEach(child => {
            const item = child.val();
            items.push({
                id: child.key,
                ...item,
                // Không gửi full base64 trong danh sách, chỉ gửi flag có ảnh không
                hasImage: !!(item.imageBase64 && item.imageBase64.length > 200),
                imageBase64: undefined  // Sẽ lấy riêng qua endpoint image
            });
        });

        // Sắp xếp mới nhất trước
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        console.error('❌ Get undefined items error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy ảnh của một undefined item
router.get('/undefined-items/:familyId/:itemId/image', async (req, res) => {
    try {
        const snapshot = await db.ref(
            `undefined_items/${req.params.familyId}/${req.params.itemId}/imageBase64`
        ).once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Ảnh không tồn tại.' });
        }

        const buffer = Buffer.from(snapshot.val(), 'base64');
        res.set('Content-Type', 'image/jpeg');
        res.set('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy danh sách vật thể đã được người dùng định nghĩa (AI knowledge base)
router.get('/definitions/:familyId', async (req, res) => {
    try {
        const snapshot = await db.ref(`item_definitions/${req.params.familyId}`).once('value');

        const definitions = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                definitions.push({ id: child.key, ...child.val() });
            });
        }

        definitions.sort((a, b) => new Date(b.definedAt) - new Date(a.definedAt));

        res.json({
            success: true,
            count: definitions.length,
            data: definitions
        });
    } catch (error) {
        console.error('❌ Get definitions error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PUSH NOTIFICATIONS ====================

// Đăng ký Expo Push Token
router.post('/push-token', async (req, res) => {
    try {
        const { familyId, token } = req.body;
        if (!familyId || !token) {
            return res.status(400).json({ success: false, message: 'Thiếu familyId hoặc token' });
        }

        await db.ref(`push_tokens/${familyId}/${token.replace(/[.#$[\]]/g, '')}`).set({
            token,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Đã lưu Push Token' });
    } catch (error) {
        console.error('❌ Save push token error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== AI REVIEWS (Human-in-the-loop) ====================

// Lấy danh sách các bản phân tích đang chờ duyệt
router.get('/ai-reviews/:familyId', async (req, res) => {
    try {
        const snapshot = await db.ref(`ai_reviews/${req.params.familyId}`).orderByChild('status').equalTo('pending').once('value');
        
        const reviews = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                reviews.push({ id: child.key, ...child.val() });
            });
        }
        
        // Sắp xếp mới nhất lên đầu
        reviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Xác nhận và áp dụng kết quả AI đã chỉnh sửa vào Inventory
router.post('/ai-reviews/:familyId/:reviewId/confirm', async (req, res) => {
    try {
        const { familyId, reviewId } = req.params;
        const { rating, adjustedItems } = req.body; 
        // adjustedItems: [{ itemId, newPercent }]

        const reviewRef = db.ref(`ai_reviews/${familyId}/${reviewId}`);
        const reviewSnap = await reviewRef.once('value');
        if (!reviewSnap.exists()) {
            return res.status(404).json({ success: false, message: 'Review không tồn tại' });
        }

        // 1. Cập nhật vào Inventory
        if (adjustedItems && Array.isArray(adjustedItems)) {
            for (const item of adjustedItems) {
                if (item.itemId && typeof item.newPercent === 'number') {
                    const newStatus = item.newPercent <= 0 ? 'empty' : item.newPercent <= 30 ? 'critical' : item.newPercent <= 60 ? 'low' : 'full';
                    await db.ref(`inventory/${item.itemId}`).update({
                        remainingPercent: item.newPercent,
                        status: newStatus
                    });
                }
            }
        }

        // 2. Mark review as completed and save rating
        await reviewRef.update({
            status: 'completed',
            rating: rating || 0,
            completedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Đã xác nhận kết quả AI' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
