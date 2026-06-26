import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/theme';

/**
 * ShoppingItem — Item trong shopping list với checkbox
 */
export default function ShoppingItem({ item, itemName, onToggleBought, onDelete, style }) {
  const isBought = item?.bought || false;
  const priority = item?.priority || 'medium';

  const getPriorityConfig = () => {
    switch (priority) {
      case 'high':
        return { label: 'Bắt buộc', color: COLORS.priorityHigh, bg: '#FEE2E2' };
      case 'medium':
        return { label: 'Khuyến nghị', color: COLORS.priorityMedium, bg: '#FEF3C7' };
      default:
        return { label: 'Tùy chọn', color: COLORS.priorityLow, bg: '#DCFCE7' };
    }
  };

  const priorityConfig = getPriorityConfig();

  return (
    <View style={[styles.container, isBought && styles.containerBought, style]}>
      {/* Checkbox */}
      <TouchableOpacity
        style={[styles.checkbox, isBought && styles.checkboxChecked]}
        onPress={() => onToggleBought?.(itemName)}
      >
        {isBought && <Ionicons name="checkmark" size={16} color={COLORS.textOnPrimary} />}
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.name, isBought && styles.nameStrikethrough]} numberOfLines={1}>
          {itemName}
        </Text>
        <View style={styles.metaRow}>
          {item?.quantity && (
            <Text style={styles.quantity}>{item.quantity}</Text>
          )}
          <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.bg }]}>
            <Text style={[styles.priorityText, { color: priorityConfig.color }]}>
              {priorityConfig.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Delete */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete?.(itemName)}
      >
        <Ionicons name="close-circle-outline" size={20} color={COLORS.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  containerBought: {
    opacity: 0.6,
    backgroundColor: COLORS.surfaceSecondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  nameStrikethrough: {
    textDecorationLine: 'line-through',
    color: COLORS.textTertiary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  quantity: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  priorityText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  deleteBtn: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
});
