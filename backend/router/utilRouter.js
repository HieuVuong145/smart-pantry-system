const express = require('express');
const router = express.Router();
const db = require('../config/firebaseConfig');

// Database schema cho Smart Pantry
router.post('/init-db', async (req, res) => {
    try {
        const initialData = {
            // Users
            users: {
                "user_001": {
                    name: "Vương Toàn Minh Hiếu",
                    email: "hieutrung142005@gmail.com",
                    password: "123456",
                    role: "admin",
                    createdAt: new Date().toISOString()
                }
            },

            // Families
            families: {
                "family_001": {
                    name: "Gia đình Hiếu",
                    ownerId: "user_001",
                    members: {
                        "member_001": {
                            name: "Bố",
                            role: "adult",
                            age: 50,
                            gender: "male",
                            height_cm: 170,
                            weight_kg: 70,
                            bodyType: "average",
                            dietaryNotes: "Ăn ít muối",
                            addedAt: new Date().toISOString()
                        },
                        "member_002": {
                            name: "Mẹ",
                            role: "adult",
                            age: 48,
                            gender: "female",
                            height_cm: 158,
                            weight_kg: 55,
                            bodyType: "average",
                            dietaryNotes: "",
                            addedAt: new Date().toISOString()
                        },
                        "member_003": {
                            name: "Con trai",
                            role: "adult",
                            age: 21,
                            gender: "male",
                            height_cm: 175,
                            weight_kg: 68,
                            bodyType: "average",
                            dietaryNotes: "",
                            addedAt: new Date().toISOString()
                        },
                        "member_004": {
                            name: "Em gái",
                            role: "child",
                            age: 12,
                            gender: "female",
                            height_cm: 148,
                            weight_kg: 38,
                            bodyType: "slim",
                            dietaryNotes: "Dị ứng tôm",
                            addedAt: new Date().toISOString()
                        }
                    },
                    mealSettings: {
                        mealsPerDay: 3,
                        avgPeoplePerMeal: 4
                    },
                    createdAt: new Date().toISOString()
                }
            },

            // Inventory
            inventory: {
                "item_001": {
                    familyId: "family_001",
                    name: "Nước mắm",
                    nameEn: "Fish sauce",
                    category: "gia_vi",
                    unit: "chai",
                    initialQuantity: 1,
                    remainingPercent: 35,
                    estimatedUsagePerMeal: 2,
                    totalUsageCount: 15,
                    totalMealsEstimate: 30,
                    addedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                    lastUsedAt: new Date().toISOString(),
                    estimatedEmptyDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
                    status: "low"
                },
                "item_002": {
                    familyId: "family_001",
                    name: "Muối",
                    nameEn: "Salt",
                    category: "gia_vi",
                    unit: "gói",
                    initialQuantity: 1,
                    remainingPercent: 15,
                    estimatedUsagePerMeal: 1,
                    totalUsageCount: 50,
                    totalMealsEstimate: 60,
                    addedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
                    lastUsedAt: new Date().toISOString(),
                    estimatedEmptyDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                    status: "critical"
                },
                "item_003": {
                    familyId: "family_001",
                    name: "Dầu ăn",
                    nameEn: "Cooking oil",
                    category: "gia_vi",
                    unit: "chai",
                    initialQuantity: 1,
                    remainingPercent: 80,
                    estimatedUsagePerMeal: 1.5,
                    totalUsageCount: 8,
                    totalMealsEstimate: 40,
                    addedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                    lastUsedAt: new Date().toISOString(),
                    estimatedEmptyDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
                    status: "full"
                },
                "item_004": {
                    familyId: "family_001",
                    name: "Trứng gà",
                    nameEn: "Chicken eggs",
                    category: "sua_trung",
                    unit: "quả",
                    initialQuantity: 10,
                    remainingPercent: 40,
                    estimatedUsagePerMeal: 2,
                    totalUsageCount: 3,
                    totalMealsEstimate: 5,
                    addedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    lastUsedAt: new Date().toISOString(),
                    estimatedEmptyDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
                    status: "low"
                },
                "item_005": {
                    familyId: "family_001",
                    name: "Đường",
                    nameEn: "Sugar",
                    category: "gia_vi",
                    unit: "kg",
                    initialQuantity: 1,
                    remainingPercent: 0,
                    estimatedUsagePerMeal: 0.5,
                    totalUsageCount: 80,
                    totalMealsEstimate: 80,
                    addedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                    lastUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    estimatedEmptyDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    status: "empty"
                }
            },

            // Pantry device
            pantry_device: {
                "device_001": {
                    familyId: "family_001",
                    name: "Pantry Cam - Giá bếp",
                    status: "deep_sleep",
                    lastActive: new Date().toISOString(),
                    lastMotionDetected: null,
                    triggerCount: 0,
                    photoCount: 0,
                    wakeCount: 0,
                    createdAt: new Date().toISOString()
                }
            },

            // Activity logs (sample)
            activity_logs: {
                "log_001": {
                    familyId: "family_001",
                    deviceId: "device_001",
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    eventType: "motion_detected",
                    detectedItems: ["Nước mắm", "Muối", "Dầu ăn"],
                    action: "took_out",
                    aiAnalysis: "Lấy ra nước mắm và muối, chuẩn bị nấu ăn",
                    aiProvider: "mock"
                }
            },

            // Shopping list
            shopping_list: {
                "list_001": {
                    familyId: "family_001",
                    createdAt: new Date().toISOString(),
                    status: "pending",
                    itemCount: 3,
                    items: {
                        "Đường": { quantity: "1 kg", category: "gia_vi", priority: "high", currentRemaining: "0%", bought: false },
                        "Muối": { quantity: "1 gói", category: "gia_vi", priority: "high", currentRemaining: "15%", bought: false },
                        "Nước mắm": { quantity: "1 chai", category: "gia_vi", priority: "medium", currentRemaining: "35%", bought: false }
                    }
                }
            }
        };

        await db.ref('/').update(initialData);
        res.json({ success: true, message: "Smart Pantry database initialized!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test Firebase connection
router.post('/test-db', async (req, res) => {
    try {
        const ref = db.ref('test_connection');
        await ref.set({
            time: new Date().toISOString(),
            status: "Smart Pantry backend connected to Firebase!"
        });
        res.json({ success: true, message: "data sent to Firebase" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;