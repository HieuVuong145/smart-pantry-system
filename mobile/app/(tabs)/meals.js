import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Modal, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mealAPI } from '../../services/api';
import MealCard from '../../components/MealCard';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, CATEGORY_LABELS } from '../../constants/theme';

const FAMILY_ID = 'family_001';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Bữa sáng', icon: 'sunny-outline', color: '#F59E0B' },
  { key: 'lunch', label: 'Bữa trưa', icon: 'restaurant-outline', color: '#F97316' },
  { key: 'dinner', label: 'Bữa tối', icon: 'moon-outline', color: '#8B5CF6' },
  { key: 'snack', label: 'Bữa phụ', icon: 'cafe-outline', color: '#06B6D4' },
];

export default function MealsScreen() {
  const [meals, setMeals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatsView, setShowStatsView] = useState(false);

  // Create meal form
  const [newMealName, setNewMealName] = useState('');
  const [newMealType, setNewMealType] = useState('lunch');
  const [newIngredients, setNewIngredients] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMeals();
    fetchStats();
  }, []);

  const fetchMeals = async () => {
    try {
      const result = await mealAPI.getAll(FAMILY_ID);
      if (result.success) {
        setMeals(result.data || []);
      }
    } catch (error) {
      console.log('Fetch meals error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const result = await mealAPI.getStats(FAMILY_ID, 7);
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.log('Fetch stats error:', error.message);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMeals(), fetchStats()]);
    setRefreshing(false);
  }, []);

  const handleCreateMeal = async () => {
    setCreating(true);
    try {
      // Parse ingredients from comma-separated string
      const ingredients = newIngredients
        .split(',')
        .map(i => i.trim())
        .filter(i => i.length > 0)
        .map(name => ({ name, category: 'khac' }));

      const data = {
        familyId: FAMILY_ID,
        name: newMealName.trim() || undefined,
        mealType: newMealType,
        ingredients,
      };

      const result = await mealAPI.create(data);
      if (result.success) {
        Alert.alert('Thành công', result.message);
        setShowCreateModal(false);
        resetForm();
        await fetchMeals();
        await fetchStats();
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMeal = (meal) => {
    Alert.alert(
      'Xóa bữa ăn',
      `Xóa "${meal.name}"?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await mealAPI.delete(meal.id);
              await fetchMeals();
              await fetchStats();
            } catch (error) {
              Alert.alert('Lỗi', error.message);
            }
          },
        },
      ]
    );
  };

  const handleMealPress = (meal) => {
    const ingredients = (meal.ingredients || []).map(i => i.name || i).join(', ');
    Alert.alert(
      meal.name,
      `Loại: ${MEAL_TYPES.find(t => t.key === meal.mealType)?.label || meal.mealType}\n`
      + `Nguyên liệu: ${ingredients || 'Không có'}\n`
      + `Thời gian: ${new Date(meal.createdAt).toLocaleString('vi-VN')}`,
      [
        { text: 'Xóa', style: 'destructive', onPress: () => handleDeleteMeal(meal) },
        { text: 'Đóng' },
      ]
    );
  };

  const resetForm = () => {
    setNewMealName('');
    setNewMealType('lunch');
    setNewIngredients('');
  };

  // Group meals by date
  const groupedMeals = meals.reduce((groups, meal) => {
    const date = new Date(meal.createdAt).toLocaleDateString('vi-VN');
    if (!groups[date]) groups[date] = [];
    groups[date].push(meal);
    return groups;
  }, {});

  const getMaxIngredientCount = () => {
    if (!stats?.topIngredients?.length) return 1;
    return stats.topIngredients[0]?.count || 1;
  };

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
        <View>
          <Text style={styles.headerTitle}>Bữa ăn</Text>
          <Text style={styles.headerSubtitle}>
            {meals.length} bữa ăn đã ghi nhận
          </Text>
        </View>
        <TouchableOpacity
          style={styles.statsToggle}
          onPress={() => setShowStatsView(!showStatsView)}
        >
          <Ionicons
            name={showStatsView ? 'list-outline' : 'stats-chart-outline'}
            size={22}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Stats View */}
      {showStatsView && stats ? (
        <ScrollView
          style={styles.statsContainer}
          contentContainerStyle={styles.statsScrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Cards */}
          <View style={styles.statsSummaryRow}>
            <View style={styles.statsSummaryCard}>
              <Text style={styles.statsNumber}>{stats.totalMeals}</Text>
              <Text style={styles.statsLabel}>Bữa ăn</Text>
            </View>
            <View style={styles.statsSummaryCard}>
              <Text style={styles.statsNumber}>{stats.mealsPerDay}</Text>
              <Text style={styles.statsLabel}>Bữa/ngày</Text>
            </View>
            <View style={styles.statsSummaryCard}>
              <Text style={styles.statsNumber}>{stats.totalIngredientsUsed}</Text>
              <Text style={styles.statsLabel}>Lượt dùng NL</Text>
            </View>
          </View>

          {/* Meal Type Distribution */}
          <View style={styles.statsSection}>
            <Text style={styles.statsSectionTitle}>Phân bố bữa ăn (7 ngày)</Text>
            <View style={styles.mealTypeGrid}>
              {MEAL_TYPES.map(type => {
                const count = stats.mealTypeDistribution?.[type.key] || 0;
                return (
                  <View key={type.key} style={styles.mealTypeCard}>
                    <View style={[styles.mealTypeIcon, { backgroundColor: type.color + '15' }]}>
                      <Ionicons name={type.icon} size={20} color={type.color} />
                    </View>
                    <Text style={styles.mealTypeCount}>{count}</Text>
                    <Text style={styles.mealTypeLabel}>{type.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Top Ingredients */}
          <View style={styles.statsSection}>
            <Text style={styles.statsSectionTitle}>Nguyên liệu sử dụng nhiều nhất</Text>
            {stats.topIngredients?.length > 0 ? (
              stats.topIngredients.map((ing, idx) => (
                <View key={idx} style={styles.topIngRow}>
                  <Text style={styles.topIngRank}>#{idx + 1}</Text>
                  <View style={styles.topIngContent}>
                    <View style={styles.topIngHeader}>
                      <Text style={styles.topIngName}>{ing.name}</Text>
                      <Text style={styles.topIngCount}>{ing.count} lần</Text>
                    </View>
                    <View style={styles.topIngBarBg}>
                      <View
                        style={[
                          styles.topIngBar,
                          {
                            width: `${(ing.count / getMaxIngredientCount()) * 100}%`,
                            backgroundColor: idx === 0 ? COLORS.primary : idx === 1 ? COLORS.primaryLight : COLORS.primary + '60',
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>Chưa có dữ liệu</Text>
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      ) : (
        /* Meal List View */
        <FlatList
          data={meals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MealCard
              meal={item}
              onPress={handleMealPress}
              onDelete={handleDeleteMeal}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="restaurant-outline"
              title="Chưa có bữa ăn nào"
              subtitle="Tạo bữa ăn đầu tiên hoặc scan nguyên liệu với action 'Lấy ra dùng'"
            />
          }
        />
      )}

      {/* FAB — Create Meal */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={COLORS.textOnPrimary} />
      </TouchableOpacity>

      {/* Create Meal Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo bữa ăn mới</Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Meal Name */}
            <Text style={styles.inputLabel}>Tên bữa ăn (tùy chọn)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="VD: Bữa trưa gia đình, Cơm tối..."
              placeholderTextColor={COLORS.textTertiary}
              value={newMealName}
              onChangeText={setNewMealName}
            />

            {/* Meal Type */}
            <Text style={styles.inputLabel}>Loại bữa ăn</Text>
            <View style={styles.mealTypeRow2}>
              {MEAL_TYPES.map(type => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.mealTypeOption,
                    newMealType === type.key && { borderColor: type.color, backgroundColor: type.color + '10' },
                  ]}
                  onPress={() => setNewMealType(type.key)}
                >
                  <Ionicons
                    name={type.icon}
                    size={18}
                    color={newMealType === type.key ? type.color : COLORS.textTertiary}
                  />
                  <Text
                    style={[
                      styles.mealTypeOptionText,
                      newMealType === type.key && { color: type.color, fontWeight: FONT_WEIGHT.semibold },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Ingredients */}
            <Text style={styles.inputLabel}>Nguyên liệu (cách nhau bằng dấu phẩy)</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="VD: Thịt bò, Rau muống, Nước mắm, Tỏi..."
              placeholderTextColor={COLORS.textTertiary}
              value={newIngredients}
              onChangeText={setNewIngredients}
              multiline
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
              onPress={handleCreateMeal}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <Text style={styles.submitBtnText}>Tạo bữa ăn</Text>
              )}
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
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  statsToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // List
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
    paddingTop: SPACING.sm,
  },
  // Stats View
  statsContainer: {
    flex: 1,
  },
  statsScrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statsSummaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  statsNumber: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.extrabold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statsLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  statsSection: {
    marginBottom: SPACING.xl,
  },
  statsSectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  mealTypeGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  mealTypeCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  mealTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  mealTypeCount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  mealTypeLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Top ingredients
  topIngRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  topIngRank: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    width: 30,
  },
  topIngContent: {
    flex: 1,
  },
  topIngHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  topIngName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
  },
  topIngCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  topIngBarBg: {
    height: 6,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 3,
  },
  topIngBar: {
    height: 6,
    borderRadius: 3,
  },
  noDataText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
  // FAB
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
    maxHeight: '85%',
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
  mealTypeRow2: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  mealTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  mealTypeOptionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    ...SHADOWS.md,
    shadowColor: COLORS.primary,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
  },
});
