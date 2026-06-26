import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shoppingAPI, inventoryAPI } from '../../services/api';
import ShoppingItem from '../../components/ShoppingItem';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const FAMILY_ID = 'family_001';

export default function ShoppingScreen() {
  const [shoppingList, setShoppingList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');

  useEffect(() => {
    fetchShoppingList();
  }, []);

  const fetchShoppingList = async () => {
    try {
      const result = await shoppingAPI.getCurrent(FAMILY_ID);
      if (result.success && result.data) {
        setShoppingList(result.data);
      } else {
        setShoppingList(null);
      }
    } catch (error) {
      console.log('Fetch shopping error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchShoppingList();
    setRefreshing(false);
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await shoppingAPI.generate(FAMILY_ID);
      if (result.success) {
        await fetchShoppingList();
        Alert.alert('Thành công', 'Đã tạo danh sách mua sắm mới dựa trên nguyên liệu sắp hết.');
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkBought = async (itemName) => {
    if (!shoppingList) return;
    try {
      await shoppingAPI.markBought(shoppingList.id, itemName);
      await fetchShoppingList();
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleDeleteItem = async (itemName) => {
    if (!shoppingList) return;
    Alert.alert('Xoá', `Xoá "${itemName}" khỏi danh sách?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          try {
            await shoppingAPI.removeItem(shoppingList.id, itemName);
            await fetchShoppingList();
          } catch (error) {
            Alert.alert('Lỗi', error.message);
          }
        },
      },
    ]);
  };

  const handleAddManualItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên vật phẩm.');
      return;
    }
    if (!shoppingList) {
      Alert.alert('Thông báo', 'Vui lòng tạo danh sách mua sắm trước.');
      return;
    }
    try {
      await shoppingAPI.addItem(
        shoppingList.id,
        newItemName.trim(),
        newItemQty || '1',
        'medium'
      );
      setNewItemName('');
      setNewItemQty('');
      setShowAddModal(false);
      await fetchShoppingList();
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleFinishShopping = () => {
    Alert.alert(
      'Đi chợ xong?',
      'Các nguyên liệu đã mua sẽ được bổ sung vào kho.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              if (shoppingList) {
                await shoppingAPI.deleteList(shoppingList.id);
              }
              await fetchShoppingList();
              Alert.alert('Thành công', 'Đã hoàn tất mua sắm! 🎉');
            } catch (error) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  // Parse items from shopping list
  const items = shoppingList?.items || {};
  const itemEntries = Object.entries(items);
  const mustBuyItems = itemEntries.filter(([, item]) => item.priority === 'high');
  const shouldBuyItems = itemEntries.filter(([, item]) => item.priority !== 'high');
  const totalItems = itemEntries.length;
  const boughtItems = itemEntries.filter(([, item]) => item.bought).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Danh sách mua sắm</Text>
        {shoppingList && totalItems > 0 && (
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {boughtItems}/{totalItems} đã mua
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${totalItems > 0 ? (boughtItems / totalItems) * 100 : 0}%` },
                ]}
              />
            </View>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Generate button */}
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color={COLORS.primary} />
              <Text style={styles.generateBtnText}>Tạo danh sách từ nguyên liệu sắp hết</Text>
            </>
          )}
        </TouchableOpacity>

        {/* No list */}
        {!shoppingList && (
          <EmptyState
            icon="cart-outline"
            title="Chưa có danh sách mua sắm"
            subtitle="Nhấn nút trên để tự động tạo danh sách dựa trên nguyên liệu sắp hết"
          />
        )}

        {/* Must Buy */}
        {mustBuyItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionDot, { backgroundColor: COLORS.statusLow }]} />
                <Text style={styles.sectionTitle}>Bắt buộc mua</Text>
              </View>
              <View style={styles.mustBuyBadge}>
                <Text style={styles.mustBuyBadgeText}>{mustBuyItems.length}</Text>
              </View>
            </View>
            {mustBuyItems.map(([name, item]) => (
              <ShoppingItem
                key={name}
                itemName={name}
                item={item}
                onToggleBought={handleMarkBought}
                onDelete={handleDeleteItem}
              />
            ))}
          </View>
        )}

        {/* Should Buy */}
        {shouldBuyItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionDot, { backgroundColor: COLORS.statusHalf }]} />
                <Text style={styles.sectionTitle}>Khuyến nghị mua</Text>
              </View>
              <View style={styles.shouldBuyBadge}>
                <Text style={styles.shouldBuyBadgeText}>{shouldBuyItems.length}</Text>
              </View>
            </View>
            {shouldBuyItems.map(([name, item]) => (
              <ShoppingItem
                key={name}
                itemName={name}
                item={item}
                onToggleBought={handleMarkBought}
                onDelete={handleDeleteItem}
              />
            ))}
          </View>
        )}

        {/* Actions */}
        {shoppingList && totalItems > 0 && (
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.addItemBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addItemText}>Thêm vật phẩm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.finishBtn}
              onPress={handleFinishShopping}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={20} color={COLORS.textOnPrimary} />
              <Text style={styles.finishBtnText}>Đi chợ xong</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Item Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm vật phẩm</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Tên vật phẩm *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="VD: Nước mắm, Gạo..."
              placeholderTextColor={COLORS.textTertiary}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Số lượng</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="VD: 1 chai, 2 kg..."
              placeholderTextColor={COLORS.textTertiary}
              value={newItemQty}
              onChangeText={setNewItemQty}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddManualItem}>
              <Text style={styles.submitBtnText}>Thêm vào danh sách</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.base,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  progressInfo: {
    gap: SPACING.xs,
  },
  progressText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.base,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '08',
    marginBottom: SPACING.lg,
  },
  generateBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  mustBuyBadge: {
    backgroundColor: COLORS.statusLow + '15',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mustBuyBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.statusLow,
  },
  shouldBuyBadge: {
    backgroundColor: COLORS.statusHalf + '15',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shouldBuyBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.statusHalf,
  },
  bottomActions: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.base,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
  },
  addItemText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    height: 52,
    ...SHADOWS.md,
    shadowColor: COLORS.success,
  },
  finishBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  submitBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
  },
});
