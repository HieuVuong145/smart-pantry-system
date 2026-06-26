import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants/theme';

/**
 * MealCard — Card hiển thị 1 bữa ăn trong danh sách
 */

const MEAL_TYPE_INFO = {
  breakfast: { label: 'Bữa sáng', icon: 'sunny-outline', color: '#F59E0B' },
  lunch: { label: 'Bữa trưa', icon: 'restaurant-outline', color: '#F97316' },
  dinner: { label: 'Bữa tối', icon: 'moon-outline', color: '#8B5CF6' },
  snack: { label: 'Bữa phụ', icon: 'cafe-outline', color: '#06B6D4' },
};

export default function MealCard({ meal, onPress, onDelete }) {
  const mealInfo = MEAL_TYPE_INFO[meal.mealType] || MEAL_TYPE_INFO.lunch;
  const ingredients = meal.ingredients || [];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Hôm nay, ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Hôm qua, ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(meal)}
      activeOpacity={0.7}
      onLongPress={() => onDelete?.(meal)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.mealTypeRow}>
          <View style={[styles.mealTypeIcon, { backgroundColor: mealInfo.color + '15' }]}>
            <Ionicons name={mealInfo.icon} size={18} color={mealInfo.color} />
          </View>
          <View style={styles.mealHeaderText}>
            <Text style={styles.mealName}>{meal.name || mealInfo.label}</Text>
            <Text style={styles.mealTime}>{formatDate(meal.createdAt)}</Text>
          </View>
        </View>

        <View style={[styles.mealTypeBadge, { backgroundColor: mealInfo.color + '12' }]}>
          <Text style={[styles.mealTypeBadgeText, { color: mealInfo.color }]}>
            {mealInfo.label}
          </Text>
        </View>
      </View>

      {/* Ingredients chips */}
      {ingredients.length > 0 && (
        <View style={styles.ingredientsRow}>
          {ingredients.slice(0, 5).map((ing, idx) => {
            const name = ing.name || ing;
            const category = ing.category || 'khac';
            const chipColor = CATEGORY_COLORS[category] || COLORS.categoryKhac;
            return (
              <View key={idx} style={[styles.ingredientChip, { borderColor: chipColor + '30' }]}>
                <Ionicons
                  name={CATEGORY_ICONS[category] || 'cube-outline'}
                  size={12}
                  color={chipColor}
                />
                <Text style={[styles.ingredientText, { color: chipColor }]} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            );
          })}
          {ingredients.length > 5 && (
            <View style={styles.moreChip}>
              <Text style={styles.moreText}>+{ingredients.length - 5}</Text>
            </View>
          )}
        </View>
      )}

      {/* Empty ingredients */}
      {ingredients.length === 0 && (
        <Text style={styles.noIngredients}>Chưa có nguyên liệu</Text>
      )}

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <Ionicons name="leaf-outline" size={14} color={COLORS.textTertiary} />
          <Text style={styles.footerText}>{ingredients.length} nguyên liệu</Text>
        </View>
        {meal.hasImage && (
          <View style={styles.footerRight}>
            <Ionicons name="image-outline" size={14} color={COLORS.textTertiary} />
            <Text style={styles.footerText}>Có ảnh</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  mealTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mealTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  mealHeaderText: {
    flex: 1,
  },
  mealName: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  mealTime: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  mealTypeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: SPACING.sm,
  },
  mealTypeBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  // Ingredients
  ingredientsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
  },
  ingredientText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    maxWidth: 80,
  },
  moreChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
  },
  moreText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
  },
  noIngredients: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  // Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  footerText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
});
