const express = require('express');
const router = express.Router();
const db = require('../config/firebaseConfig');

/**
 * Family Router — Quản lý hồ sơ gia đình và thành viên
 */

// Tạo gia đình mới
router.post('/', async (req, res) => {
    try {
        const { name, ownerId, mealsPerDay, avgPeoplePerMeal } = req.body;
        const newFamilyRef = db.ref('families').push();
        await newFamilyRef.set({
            name,
            ownerId,
            members: {},
            mealSettings: {
                mealsPerDay: mealsPerDay || 3,
                avgPeoplePerMeal: avgPeoplePerMeal || 4
            },
            createdAt: new Date().toISOString()
        });
        res.json({ success: true, familyId: newFamilyRef.key, message: 'Tạo gia đình thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy thông tin gia đình
router.get('/:familyId', async (req, res) => {
    try {
        const snapshot = await db.ref(`families/${req.params.familyId}`).once('value');
        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Gia đình không tồn tại.' });
        }
        res.json({ success: true, data: { id: req.params.familyId, ...snapshot.val() } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cập nhật meal settings
router.put('/:familyId/settings', async (req, res) => {
    try {
        const { mealsPerDay, avgPeoplePerMeal } = req.body;
        await db.ref(`families/${req.params.familyId}/mealSettings`).update({
            mealsPerDay, avgPeoplePerMeal
        });
        res.json({ success: true, message: 'Cập nhật cài đặt bữa ăn thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Thêm thành viên gia đình
router.post('/:familyId/members', async (req, res) => {
    try {
        const { name, role, age, gender, height_cm, weight_kg, bodyType, dietaryNotes } = req.body;

        if (!name || !role) {
            return res.status(400).json({ success: false, message: 'Cần có name và role.' });
        }

        const validRoles = ['adult', 'child', 'elderly'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: `Role phải là: ${validRoles.join(', ')}` });
        }

        const validBodyTypes = ['slim', 'average', 'large'];
        if (bodyType && !validBodyTypes.includes(bodyType)) {
            return res.status(400).json({ success: false, message: `bodyType phải là: ${validBodyTypes.join(', ')}` });
        }

        const newMemberRef = db.ref(`families/${req.params.familyId}/members`).push();
        await newMemberRef.set({
            name,
            role,
            age: age || null,
            gender: gender || null,
            height_cm: height_cm || null,
            weight_kg: weight_kg || null,
            bodyType: bodyType || 'average',
            dietaryNotes: dietaryNotes || '',
            addedAt: new Date().toISOString()
        });

        res.json({ success: true, memberId: newMemberRef.key, message: 'Thêm thành viên thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cập nhật thành viên
router.put('/:familyId/members/:memberId', async (req, res) => {
    try {
        const { familyId, memberId } = req.params;
        const memberRef = db.ref(`families/${familyId}/members/${memberId}`);
        const snapshot = await memberRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ success: false, message: 'Thành viên không tồn tại.' });
        }

        await memberRef.update({
            ...req.body,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Cập nhật thành viên thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Xoá thành viên
router.delete('/:familyId/members/:memberId', async (req, res) => {
    try {
        const { familyId, memberId } = req.params;
        await db.ref(`families/${familyId}/members/${memberId}`).remove();
        res.json({ success: true, message: 'Xoá thành viên thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Lấy danh sách gia đình của user
router.get('/user/:userId', async (req, res) => {
    try {
        const snapshot = await db.ref('families')
            .orderByChild('ownerId')
            .equalTo(req.params.userId)
            .once('value');

        const families = [];
        snapshot.forEach(child => {
            families.push({ id: child.key, ...child.val() });
        });

        res.json({ success: true, data: families });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
