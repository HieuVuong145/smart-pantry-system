const db = require('../config/firebaseConfig');
const { getLowStockItems } = require('./inventoryService');

/**
 * Shopping Service — Tạo và quản lý danh sách mua sắm tự động
 */

/**
 * Tự động tạo shopping list từ nguyên liệu sắp hết
 */
async function generateShoppingList(familyId) {
    const lowItems = await getLowStockItems(familyId);

    if (lowItems.length === 0) {
        return { message: 'Tất cả nguyên liệu còn đủ dùng!', items: {} };
    }

    const shoppingItems = {};

    for (const item of lowItems) {
        let priority = 'low';
        if (item.status === 'empty') priority = 'high';
        else if (item.status === 'critical') priority = 'high';
        else if (item.status === 'low') priority = 'medium';

        shoppingItems[item.name] = {
            quantity: `${item.initialQuantity || 1} ${item.unit || 'phần'}`,
            category: item.category || 'khac',
            priority,
            currentRemaining: item.remainingPercent + '%',
            estimatedEmptyDate: item.estimatedEmptyDate || null,
            bought: false,
            inventoryItemId: item.id
        };
    }

    // Save to Firebase
    const listRef = db.ref('shopping_list').push();
    const listData = {
        familyId,
        createdAt: new Date().toISOString(),
        status: 'pending',
        itemCount: Object.keys(shoppingItems).length,
        items: shoppingItems
    };

    await listRef.set(listData);

    return {
        listId: listRef.key,
        ...listData
    };
}

/**
 * Đánh dấu item đã mua
 */
async function markItemBought(listId, itemName) {
    const itemRef = db.ref(`shopping_list/${listId}/items/${itemName}`);
    const snapshot = await itemRef.once('value');
    
    if (!snapshot.exists()) {
        throw new Error(`Item "${itemName}" not found in shopping list`);
    }

    await itemRef.update({
        bought: true,
        boughtAt: new Date().toISOString()
    });

    // Check if all items are bought → mark list as completed
    const listSnapshot = await db.ref(`shopping_list/${listId}/items`).once('value');
    let allBought = true;
    listSnapshot.forEach(child => {
        if (!child.val().bought) allBought = false;
    });

    if (allBought) {
        await db.ref(`shopping_list/${listId}`).update({
            status: 'completed',
            completedAt: new Date().toISOString()
        });
    }

    return { success: true, allComplete: allBought };
}

/**
 * Lấy shopping list hiện tại (pending)
 */
async function getCurrentShoppingList(familyId) {
    const snapshot = await db.ref('shopping_list')
        .orderByChild('familyId')
        .equalTo(familyId)
        .once('value');

    const lists = [];
    snapshot.forEach(child => {
        const list = child.val();
        if (list.status === 'pending') {
            lists.push({ id: child.key, ...list });
        }
    });

    // Return the most recent pending list
    return lists.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

/**
 * Lấy lịch sử shopping lists
 */
async function getShoppingHistory(familyId, limit = 10) {
    const snapshot = await db.ref('shopping_list')
        .orderByChild('familyId')
        .equalTo(familyId)
        .once('value');

    const lists = [];
    snapshot.forEach(child => {
        lists.push({ id: child.key, ...child.val() });
    });

    return lists
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
}

module.exports = {
    generateShoppingList,
    markItemBought,
    getCurrentShoppingList,
    getShoppingHistory
};
