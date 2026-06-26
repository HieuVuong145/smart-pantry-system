const db = require('../config/firebaseConfig');

/**
 * Inventory Service — Logic quản lý và ước tính mức sử dụng nguyên liệu
 */

// Danh sách nguyên liệu phổ biến Việt Nam với thông tin mặc định
const DEFAULT_INGREDIENTS = {
    'gia_vi': {
        'Muối': { unit: 'gói', defaultQuantity: 1, usagePerMeal: 1, totalMealsEstimate: 60 },
        'Đường': { unit: 'kg', defaultQuantity: 1, usagePerMeal: 0.5, totalMealsEstimate: 80 },
        'Nước mắm': { unit: 'chai', defaultQuantity: 1, usagePerMeal: 2, totalMealsEstimate: 30 },
        'Dầu ăn': { unit: 'chai', defaultQuantity: 1, usagePerMeal: 1.5, totalMealsEstimate: 40 },
        'Bột ngọt': { unit: 'gói', defaultQuantity: 1, usagePerMeal: 0.5, totalMealsEstimate: 100 },
        'Hạt nêm': { unit: 'gói', defaultQuantity: 1, usagePerMeal: 1, totalMealsEstimate: 50 },
        'Tương ớt': { unit: 'chai', defaultQuantity: 1, usagePerMeal: 0.5, totalMealsEstimate: 60 },
        'Nước tương': { unit: 'chai', defaultQuantity: 1, usagePerMeal: 1, totalMealsEstimate: 40 },
    },
    'thit_ca': {
        'Thịt bò': { unit: 'kg', defaultQuantity: 0.5, usagePerMeal: 100, totalMealsEstimate: 1 },
        'Thịt heo': { unit: 'kg', defaultQuantity: 0.5, usagePerMeal: 100, totalMealsEstimate: 1 },
        'Cá': { unit: 'con', defaultQuantity: 1, usagePerMeal: 100, totalMealsEstimate: 1 },
        'Tôm': { unit: 'kg', defaultQuantity: 0.3, usagePerMeal: 100, totalMealsEstimate: 1 },
        'Gà': { unit: 'kg', defaultQuantity: 1, usagePerMeal: 100, totalMealsEstimate: 1 },
    },
    'rau_cu': {
        'Rau muống': { unit: 'bó', defaultQuantity: 1, usagePerMeal: 100, totalMealsEstimate: 1 },
        'Cà chua': { unit: 'quả', defaultQuantity: 3, usagePerMeal: 50, totalMealsEstimate: 2 },
        'Hành lá': { unit: 'bó', defaultQuantity: 1, usagePerMeal: 30, totalMealsEstimate: 3 },
        'Tỏi': { unit: 'củ', defaultQuantity: 5, usagePerMeal: 20, totalMealsEstimate: 5 },
    },
    'sua_trung': {
        'Trứng gà': { unit: 'quả', defaultQuantity: 10, usagePerMeal: 2, totalMealsEstimate: 5 },
        'Sữa tươi': { unit: 'hộp', defaultQuantity: 1, usagePerMeal: 50, totalMealsEstimate: 2 },
    }
};

/**
 * Cập nhật inventory khi phát hiện nguyên liệu từ ảnh AI
 */
async function updateInventoryFromAI(familyId, aiResult, wakeReason = 'pir', logId = null) {
    const updates = [];
    const reviewItems = []; // Danh sách cần user xác nhận
    const inventoryRef = db.ref('inventory');
    
    try {
        const snapshot = await inventoryRef
            .orderByChild('familyId')
            .equalTo(familyId)
            .once('value');

        const dbItems = {};
        snapshot.forEach(child => {
            const val = child.val();
            dbItems[val.name.toLowerCase()] = { key: child.key, ...val };
        });

        const imageItems = {};
        for (const item of aiResult.items) {
            if (item.needsDefinition) continue;
            imageItems[(item.name || '').toLowerCase()] = item;
        }

        // 1. Missing items -> Took out
        for (const [name, dbItem] of Object.entries(dbItems)) {
            if (!imageItems[name]) {
                // Item is in DB but NOT in image -> Taken out!
                const newUsageCount = (dbItem.totalUsageCount || 0) + 1;
                const totalMeals = dbItem.totalMealsEstimate || 10;
                
                // Trừ 1% mỗi lần lấy ra sử dụng (như user yêu cầu)
                const currentPercent = dbItem.remainingPercent !== undefined ? dbItem.remainingPercent : 100;
                const newRemaining = Math.max(0, currentPercent - 1);
                
                let status = 'full';
                if (newRemaining <= 0) status = 'empty';
                else if (newRemaining <= 30) status = 'critical';
                else if (newRemaining <= 60) status = 'low';

                const estimatedEmptyDate = calculateEmptyDate(
                    dbItem.addedAt,
                    newUsageCount,
                    totalMeals
                );

                await inventoryRef.child(dbItem.key).update({
                    totalUsageCount: newUsageCount,
                    remainingPercent: newRemaining,
                    lastUsedAt: new Date().toISOString(),
                    estimatedEmptyDate,
                    status
                });
                updates.push({ item: dbItem.name, name: dbItem.name, action: 'used', remaining: newRemaining + '%', remainingPercent: newRemaining });
            }
        }

        // 2. Visible items
        for (const [name, imgItem] of Object.entries(imageItems)) {
            const existingItem = dbItems[name];
            
            let percent = 100;
            if (typeof imgItem.estimatedPercent === 'number') {
                percent = Math.min(100, Math.max(0, imgItem.estimatedPercent));
            } else if (imgItem.condition) {
                if (imgItem.condition === 'empty') percent = 0;
                else if (imgItem.condition === 'low') percent = 25;
                else if (imgItem.condition === 'ok') percent = 75;
            }

            if (existingItem) {
                const currentPercent = existingItem.remainingPercent !== undefined ? existingItem.remainingPercent : 100;
                
                // Nếu AI phân tích định kỳ hoặc thủ công hoặc bật nguồn, ta lưu kết quả chờ User duyệt thay vì cập nhật thẳng
                if (wakeReason === 'timer' || wakeReason === 'manual_capture' || wakeReason === 'power_on') {
                    reviewItems.push({
                        itemId: existingItem.key,
                        name: existingItem.name,
                        oldPercent: currentPercent,
                        newPercent: percent
                    });
                }
                
                // Cập nhật lại status theo chuẩn 3 mức mới (Phòng khi chưa update)
                const newStatus = currentPercent <= 0 ? 'empty' : currentPercent <= 30 ? 'critical' : currentPercent <= 60 ? 'low' : 'full';
                
                if (existingItem.status !== newStatus) {
                    await inventoryRef.child(existingItem.key).update({
                        status: newStatus
                    });
                }
            } else {
                // New item added to shelf
                const defaultInfo = findDefaultInfo(imgItem.name, imgItem.category);
                const newRef = inventoryRef.push();
                await newRef.set({
                    familyId,
                    name: imgItem.name,
                    nameEn: imgItem.nameEn || '',
                    category: imgItem.category || 'khac',
                    unit: imgItem.estimatedQuantity || defaultInfo.unit,
                    initialQuantity: defaultInfo.defaultQuantity,
                    remainingPercent: percent,
                    estimatedUsagePerMeal: defaultInfo.usagePerMeal,
                    totalUsageCount: 0,
                    totalMealsEstimate: defaultInfo.totalMealsEstimate,
                    addedAt: new Date().toISOString(),
                    lastUsedAt: null,
                    estimatedEmptyDate: null,
                    status: percent <= 0 ? 'empty' : percent <= 25 ? 'low' : percent <= 75 ? 'ok' : 'full'
                });
                
                // Bắt người dùng duyệt (Review) cả những món mới được AI thêm vào lần đầu
                if (wakeReason === 'timer' || wakeReason === 'manual_capture' || wakeReason === 'power_on') {
                    reviewItems.push({
                        itemId: newRef.key,
                        name: imgItem.name,
                        oldPercent: 0, // Món mới mặc định cũ là 0%
                        newPercent: percent
                    });
                }
                
                updates.push({ item: imgItem.name, name: imgItem.name, action: 'added', remainingPercent: percent });
            }
        }
        
        // 3. Nếu có item cần review, tạo bản ghi Pending Review
        if (reviewItems.length > 0) {
            const reviewRef = db.ref(`ai_reviews/${familyId}`).push();
            await reviewRef.set({
                logId: logId,
                timestamp: new Date().toISOString(),
                status: 'pending', // 'pending' | 'completed'
                items: reviewItems
            });
        }
        
    } catch (error) {
        console.error('Error updating inventory from AI:', error);
    }

    return updates;
}

/**
 * Tính ngày dự kiến hết nguyên liệu
 */
function calculateEmptyDate(addedAt, currentUsageCount, totalMealsEstimate) {
    if (!addedAt || currentUsageCount === 0) return null;

    const addedDate = new Date(addedAt);
    const now = new Date();
    const daysSinceAdded = (now - addedDate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceAdded <= 0) return null;

    const usageRate = currentUsageCount / daysSinceAdded; // uses per day
    const remainingUses = totalMealsEstimate - currentUsageCount;
    
    if (usageRate <= 0 || remainingUses <= 0) return now.toISOString();

    const daysUntilEmpty = remainingUses / usageRate;
    const emptyDate = new Date(now.getTime() + daysUntilEmpty * 24 * 60 * 60 * 1000);
    
    return emptyDate.toISOString();
}

/**
 * Lấy thông tin mặc định cho nguyên liệu
 */
function findDefaultInfo(name, category) {
    if (category && DEFAULT_INGREDIENTS[category]) {
        const categoryItems = DEFAULT_INGREDIENTS[category];
        if (categoryItems[name]) return categoryItems[name];
    }
    // Search all categories
    for (const cat of Object.values(DEFAULT_INGREDIENTS)) {
        if (cat[name]) return cat[name];
    }
    // Fallback
    return { unit: 'phần', defaultQuantity: 1, usagePerMeal: 1, totalMealsEstimate: 10 };
}

/**
 * Lấy danh sách nguyên liệu sắp hết
 */
async function getLowStockItems(familyId) {
    const snapshot = await db.ref('inventory')
        .orderByChild('familyId')
        .equalTo(familyId)
        .once('value');

    const lowItems = [];
    snapshot.forEach(child => {
        const item = child.val();
        if (item.status === 'low' || item.status === 'critical' || item.status === 'empty') {
            lowItems.push({ id: child.key, ...item });
        }
    });

    return lowItems.sort((a, b) => a.remainingPercent - b.remainingPercent);
}

/**
 * Điều chỉnh ước tính dựa trên hồ sơ gia đình
 */
async function adjustForFamily(familyId) {
    const familySnap = await db.ref(`families/${familyId}`).once('value');
    if (!familySnap.exists()) return 1.0;

    const family = familySnap.val();
    const members = family.members || {};
    
    let totalFactor = 0;
    let memberCount = 0;
    
    for (const member of Object.values(members)) {
        memberCount++;
        let factor = 1.0;
        
        // Điều chỉnh theo vai trò
        if (member.role === 'child') factor = 0.5;
        else if (member.role === 'elderly') factor = 0.7;
        else factor = 1.0; // adult
        
        // Điều chỉnh theo tạng người
        if (member.bodyType === 'large') factor *= 1.3;
        else if (member.bodyType === 'slim') factor *= 0.8;
        
        totalFactor += factor;
    }

    return memberCount > 0 ? totalFactor : 1.0;
}

module.exports = {
    updateInventoryFromAI,
    getLowStockItems,
    adjustForFamily,
    calculateEmptyDate,
    DEFAULT_INGREDIENTS
};
