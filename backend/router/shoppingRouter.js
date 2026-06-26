const express = require('express');
const router = express.Router();
const {
    generateShoppingList,
    markItemBought,
    getCurrentShoppingList,
    getShoppingHistory
} = require('../services/shoppingService');
const db = require('../config/firebaseConfig');

/**
 * Shopping Router — Quản lý danh sách mua sắm
 */

// Tự động tạo shopping list từ nguyên liệu sắp hết
router.post('/generate/:familyId', async (req, res) => {
    try {
        const result = await generateShoppingList(req.params.familyId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy shopping list hiện tại
router.get('/current/:familyId', async (req, res) => {
    try {
        const list = await getCurrentShoppingList(req.params.familyId);
        if (!list) {
            return res.json({ success: true, data: null, message: 'Không có danh sách nào đang chờ.' });
        }
        res.json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Đánh dấu item đã mua
router.put('/:listId/bought', async (req, res) => {
    try {
        const { itemName } = req.body;
        if (!itemName) {
            return res.status(400).json({ success: false, message: 'Cần có itemName.' });
        }
        const result = await markItemBought(req.params.listId, itemName);
        res.json({ success: true, ...result, message: `Đã mua: ${itemName}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Thêm item thủ công vào shopping list
router.post('/:listId/items', async (req, res) => {
    try {
        const { itemName, quantity, priority } = req.body;
        if (!itemName) {
            return res.status(400).json({ success: false, message: 'Cần có itemName.' });
        }

        await db.ref(`shopping_list/${req.params.listId}/items/${itemName}`).set({
            quantity: quantity || '1',
            priority: priority || 'medium',
            bought: false,
            addedManually: true,
            addedAt: new Date().toISOString()
        });

        // Update item count
        const snapshot = await db.ref(`shopping_list/${req.params.listId}/items`).once('value');
        await db.ref(`shopping_list/${req.params.listId}/itemCount`).set(snapshot.numChildren());

        res.json({ success: true, message: `Đã thêm: ${itemName}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Xoá item khỏi shopping list
router.delete('/:listId/items/:itemName', async (req, res) => {
    try {
        await db.ref(`shopping_list/${req.params.listId}/items/${req.params.itemName}`).remove();
        res.json({ success: true, message: `Đã xoá: ${req.params.itemName}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy lịch sử shopping
router.get('/history/:familyId', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const lists = await getShoppingHistory(req.params.familyId, limit);
        res.json({ success: true, count: lists.length, data: lists });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Xoá shopping list
router.delete('/:listId', async (req, res) => {
    try {
        await db.ref(`shopping_list/${req.params.listId}`).remove();
        res.json({ success: true, message: 'Đã xoá danh sách mua sắm.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
