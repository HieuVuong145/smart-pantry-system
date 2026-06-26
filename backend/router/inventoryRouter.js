const express = require('express');
const router = express.Router();
const db = require('../config/firebaseConfig');
const { DEFAULT_INGREDIENTS } = require('../services/inventoryService');

/**
 * Inventory Router — CRUD nguyên liệu / thực phẩm trong tủ lạnh
 */

// Lấy toàn bộ inventory của gia đình
router.get('/family/:familyId', async (req, res) => {
    try {
        const snapshot = await db.ref('inventory')
            .orderByChild('familyId')
            .equalTo(req.params.familyId)
            .once('value');

        const items = [];
        snapshot.forEach(child => {
            items.push({ id: child.key, ...child.val() });
        });

        // Sort by status priority: empty > critical > low > medium > full
        const statusOrder = { empty: 0, critical: 1, low: 2, medium: 3, full: 4 };
        items.sort((a, b) => (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5));

        res.json({ success: true, count: items.length, data: items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy inventory theo category
router.get('/family/:familyId/category/:category', async (req, res) => {
    try {
        const snapshot = await db.ref('inventory')
            .orderByChild('familyId')
            .equalTo(req.params.familyId)
            .once('value');

        const items = [];
        snapshot.forEach(child => {
            const item = child.val();
            if (item.category === req.params.category) {
                items.push({ id: child.key, ...item });
            }
        });

        res.json({ success: true, count: items.length, data: items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Thêm nguyên liệu thủ công
router.post('/', async (req, res) => {
    try {
        const { familyId, name, category, unit, initialQuantity, totalMealsEstimate } = req.body;

        if (!familyId || !name) {
            return res.status(400).json({ success: false, message: 'Cần có familyId và name.' });
        }

        const newRef = db.ref('inventory').push();
        await newRef.set({
            familyId,
            name,
            category: category || 'khac',
            unit: unit || 'phần',
            initialQuantity: initialQuantity || 1,
            remainingPercent: 100,
            estimatedUsagePerMeal: 1,
            totalUsageCount: 0,
            totalMealsEstimate: totalMealsEstimate || 10,
            addedAt: new Date().toISOString(),
            lastUsedAt: null,
            estimatedEmptyDate: null,
            status: 'full'
        });

        res.json({ success: true, itemId: newRef.key, message: 'Thêm nguyên liệu thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cập nhật nguyên liệu (manual adjustment)
router.put('/:itemId', async (req, res) => {
    try {
        const itemRef = db.ref(`inventory/${req.params.itemId}`);
        const snapshot = await itemRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Nguyên liệu không tồn tại.' });
        }

        await itemRef.update({
            ...req.body,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Cập nhật nguyên liệu thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Xoá nguyên liệu
router.delete('/:itemId', async (req, res) => {
    try {
        await db.ref(`inventory/${req.params.itemId}`).remove();
        res.json({ success: true, message: 'Xoá nguyên liệu thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Đánh dấu đã bổ sung (refill) nguyên liệu
router.post('/:itemId/refill', async (req, res) => {
    try {
        const itemRef = db.ref(`inventory/${req.params.itemId}`);
        const snapshot = await itemRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Nguyên liệu không tồn tại.' });
        }

        await itemRef.update({
            remainingPercent: 100,
            totalUsageCount: 0,
            status: 'full',
            lastRestockedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Đã bổ sung nguyên liệu.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy nguyên liệu sắp hết
router.get('/family/:familyId/low-stock', async (req, res) => {
    try {
        const snapshot = await db.ref('inventory')
            .orderByChild('familyId')
            .equalTo(req.params.familyId)
            .once('value');

        const lowItems = [];
        snapshot.forEach(child => {
            const item = child.val();
            if (['low', 'critical', 'empty'].includes(item.status)) {
                lowItems.push({ id: child.key, ...item });
            }
        });

        lowItems.sort((a, b) => a.remainingPercent - b.remainingPercent);
        res.json({ success: true, count: lowItems.length, data: lowItems });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy danh sách nguyên liệu mặc định (để user chọn nhanh)
router.get('/defaults', (req, res) => {
    res.json({ success: true, data: DEFAULT_INGREDIENTS });
});

module.exports = router;
