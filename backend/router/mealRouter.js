const express = require('express');
const router = express.Router();
const db = require('../config/firebaseConfig');

/**
 * Meal Router — Quản lý bữa ăn, thống kê nguyên liệu sử dụng
 */

// Tự động xác định loại bữa ăn theo giờ
function autoMealType() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 20) return 'dinner';
    return 'snack';
}

function mealTypeName(type) {
    const names = {
        breakfast: 'Bữa sáng',
        lunch: 'Bữa trưa',
        dinner: 'Bữa tối',
        snack: 'Bữa phụ'
    };
    return names[type] || 'Bữa ăn';
}

// ==================== TẠO BỮA ĂN ====================

router.post('/', async (req, res) => {
    try {
        const { familyId, name, mealType, ingredients, imageBase64, createdBy } = req.body;

        if (!familyId) {
            return res.status(400).json({ success: false, message: 'Cần có familyId.' });
        }

        const autoType = mealType || autoMealType();
        const mealName = name || mealTypeName(autoType);

        const newRef = db.ref('meals').push();
        const mealData = {
            familyId,
            name: mealName,
            mealType: autoType,
            ingredients: ingredients || [],
            imageBase64: imageBase64 || null,
            createdAt: new Date().toISOString(),
            createdBy: createdBy || 'unknown',
            updatedAt: new Date().toISOString()
        };

        await newRef.set(mealData);

        console.log(`🍱 Meal created: ${mealName} (${autoType}) with ${(ingredients || []).length} ingredients`);

        res.json({
            success: true,
            mealId: newRef.key,
            data: { id: newRef.key, ...mealData },
            message: `Đã tạo ${mealName} thành công.`
        });
    } catch (error) {
        console.error('❌ Create meal error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== DANH SÁCH BỮA ĂN ====================

router.get('/:familyId', async (req, res) => {
    try {
        const { familyId } = req.params;
        const limit = parseInt(req.query.limit) || 30;
        const dateFrom = req.query.dateFrom; // ISO date string
        const dateTo = req.query.dateTo;

        const snapshot = await db.ref('meals')
            .orderByChild('familyId')
            .equalTo(familyId)
            .once('value');

        let meals = [];
        snapshot.forEach(child => {
            const meal = child.val();
            // Don't return full base64 in list
            const { imageBase64, ...mealWithoutImage } = meal;
            mealWithoutImage.hasImage = !!imageBase64;
            meals.push({ id: child.key, ...mealWithoutImage });
        });

        // Filter by date if provided
        if (dateFrom) {
            const from = new Date(dateFrom);
            meals = meals.filter(m => new Date(m.createdAt) >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo);
            meals = meals.filter(m => new Date(m.createdAt) <= to);
        }

        // Sort newest first
        meals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            count: meals.length,
            data: meals.slice(0, limit)
        });
    } catch (error) {
        console.error('❌ Get meals error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== CHI TIẾT BỮA ĂN ====================

router.get('/detail/:mealId', async (req, res) => {
    try {
        const snapshot = await db.ref(`meals/${req.params.mealId}`).once('value');
        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Bữa ăn không tồn tại.' });
        }
        res.json({ success: true, data: { id: req.params.mealId, ...snapshot.val() } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== CẬP NHẬT BỮA ĂN ====================

router.put('/:mealId', async (req, res) => {
    try {
        const { name, mealType, ingredients, imageBase64 } = req.body;
        const mealRef = db.ref(`meals/${req.params.mealId}`);

        const snapshot = await mealRef.once('value');
        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Bữa ăn không tồn tại.' });
        }

        const updates = { updatedAt: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (mealType !== undefined) updates.mealType = mealType;
        if (ingredients !== undefined) updates.ingredients = ingredients;
        if (imageBase64 !== undefined) updates.imageBase64 = imageBase64;

        await mealRef.update(updates);

        res.json({ success: true, message: 'Đã cập nhật bữa ăn.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== XÓA BỮA ĂN ====================

router.delete('/:mealId', async (req, res) => {
    try {
        const mealRef = db.ref(`meals/${req.params.mealId}`);
        const snapshot = await mealRef.once('value');
        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Bữa ăn không tồn tại.' });
        }

        await mealRef.remove();
        res.json({ success: true, message: 'Đã xóa bữa ăn.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== THỐNG KÊ ====================

router.get('/:familyId/stats', async (req, res) => {
    try {
        const { familyId } = req.params;
        const days = parseInt(req.query.days) || 7;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const snapshot = await db.ref('meals')
            .orderByChild('familyId')
            .equalTo(familyId)
            .once('value');

        const meals = [];
        snapshot.forEach(child => {
            const meal = child.val();
            if (new Date(meal.createdAt) >= cutoffDate) {
                meals.push(meal);
            }
        });

        // Đếm nguyên liệu sử dụng
        const ingredientCount = {};
        const categoryCount = {};
        const mealTypeCount = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };

        meals.forEach(meal => {
            mealTypeCount[meal.mealType] = (mealTypeCount[meal.mealType] || 0) + 1;

            (meal.ingredients || []).forEach(ing => {
                const name = ing.name || ing;
                ingredientCount[name] = (ingredientCount[name] || 0) + 1;

                if (ing.category) {
                    categoryCount[ing.category] = (categoryCount[ing.category] || 0) + 1;
                }
            });
        });

        // Top nguyên liệu sử dụng nhiều nhất
        const topIngredients = Object.entries(ingredientCount)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Phân bố theo category
        const categoryDistribution = Object.entries(categoryCount)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);

        res.json({
            success: true,
            data: {
                period: `${days} ngày gần nhất`,
                totalMeals: meals.length,
                mealsPerDay: meals.length > 0 ? (meals.length / days).toFixed(1) : 0,
                mealTypeDistribution: mealTypeCount,
                topIngredients,
                categoryDistribution,
                totalIngredientsUsed: Object.values(ingredientCount).reduce((s, c) => s + c, 0)
            }
        });
    } catch (error) {
        console.error('❌ Meal stats error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
