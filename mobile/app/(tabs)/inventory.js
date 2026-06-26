import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { inventoryAPI } from '../../services/api';
import InventoryCard from '../../components/InventoryCard';
import CategoryFilter from '../../components/CategoryFilter';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, CATEGORY_LABELS } from '../../constants/theme';

const FAMILY_ID = 'family_001';

export default function InventoryScreen() {
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'khac', unit: '' });

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredInventory(inventory);
    } else {
      setFilteredInventory(inventory.filter(i => i.category === selectedCategory));
    }
  }, [selectedCategory, inventory]);

  const fetchInventory = async () => {
    try {
      const result = await inventoryAPI.getAll(FAMILY_ID);
      if (result.success) {
        setInventory(result.data || []);
      }
    } catch (error) {
      console.log('Fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInventory();
    setRefreshing(false);
  }, []);

  const handleRefill = async (item) => {
    Alert.alert(
      'Bổ sung nguyên liệu',
      `Đã bổ sung "${item.name}" về 100%?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              await inventoryAPI.refill(item.id);
              await fetchInventory();
            } catch (error) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (item) => {
    Alert.alert(
      'Xoá nguyên liệu',
      `Xoá "${item.name}" khỏi kho?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: async () => {
            try {
              await inventoryAPI.remove(item.id);
              await fetchInventory();
            } catch (error) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên nguyên liệu.');
      return;
    }
    try {
      await inventoryAPI.add({
        familyId: FAMILY_ID,
        name: newItem.name.trim(),
        category: newItem.category,
        unit: newItem.unit || 'phần',
      });
      setShowAddModal(false);
      setNewItem({ name: '', category: 'khac', unit: '' });
      await fetchInventory();
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    }
  };

  // Stats
  const totalItems = inventory.length;
  const lowCount = inventory.filter(i => i.remainingPercent <= 30).length;

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
        <Text style={styles.headerTitle}>Kho nguyên liệu</Text>
        <View style={styles.headerStats}>
          <Text style={styles.statText}>{totalItems} items</Text>
          {lowCount > 0 && (
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>{lowCount} sắp hết</Text>
            </View>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* Inventory List */}
      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InventoryCard
            item={item}
            onPress={(i) => console.log('Pressed:', i.name)}
            onRefill={handleRefill}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="Không có nguyên liệu"
            subtitle={selectedCategory !== 'all'
              ? `Không có nguyên liệu nào trong danh mục "${CATEGORY_LABELS[selectedCategory]}"`
              : 'Chụp ảnh hoặc thêm thủ công để bắt đầu'}
          />
        }
      />

      {/* FAB — Add Item */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={COLORS.textOnPrimary} />
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm nguyên liệu</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Name input */}
            <Text style={styles.inputLabel}>Tên nguyên liệu *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="VD: Nước mắm, Thịt bò..."
              placeholderTextColor={COLORS.textTertiary}
              value={newItem.name}
              onChangeText={(text) => setNewItem({ ...newItem, name: text })}
            />

            {/* Category picker */}
            <Text style={styles.inputLabel}>Phân loại</Text>
            <View style={styles.categoryGrid}>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.categoryOption,
                    newItem.category === key && styles.categoryOptionActive,
                  ]}
                  onPress={() => setNewItem({ ...newItem, category: key })}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    newItem.category === key && styles.categoryOptionTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Unit input */}
            <Text style={styles.inputLabel}>Đơn vị</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="VD: chai, kg, gói..."
              placeholderTextColor={COLORS.textTertiary}
              value={newItem.unit}
              onChangeText={(text) => setNewItem({ ...newItem, unit: text })}
            />

            {/* Submit */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddItem}>
              <Text style={styles.submitBtnText}>Thêm nguyên liệu</Text>
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
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  warningBadge: {
    backgroundColor: COLORS.statusLow + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  warningText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.statusLow,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
    paddingTop: SPACING.sm,
  },
  fab: {
    position: 'absolute',
    right: SPACING.xl,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.lg,
    shadowColor: COLORS.primary,
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
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
    marginTop: SPACING.base,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  categoryOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  categoryOptionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  categoryOptionTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 52,
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
