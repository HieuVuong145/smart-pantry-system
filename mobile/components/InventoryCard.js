import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProgressBar from './ProgressBar';
import StatusBadge from './StatusBadge';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, CATEGORY_ICONS, CATEGORY_COLORS, CATEGORY_LABELS } from '../constants/theme';

/**
 * InventoryCard — Card nguyên liệu với progress bar, status badge
 */
export default function InventoryCard({ item, onPress, onRefill, onDelete, style }) {
  const categoryColor = CATEGORY_COLORS[item.category] || COLORS.categoryKhac;
  const categoryIcon = CATEGORY_ICONS[item.category] || 'cube-outline';
  const categoryLabel = CATEGORY_LABELS[item.category] || 'Khác';

  const getStatus = () => {
    const p = item.remainingPercent || 0;
    if (p <= 0) return 'empty';
    if (p <= 20) return 'critical';
    if (p <= 50) return 'medium';
    return 'full';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        {/* Category icon */}
        <View style={[styles.iconContainer, { backgroundColor: categoryColor + '15' }]}>
          <Ionicons name={categoryIcon} size={22} color={categoryColor} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <StatusBadge status={getStatus()} size="sm" />
          </View>

          <Text style={styles.category}>{categoryLabel} • {item.unit || ''}</Text>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            <ProgressBar percent={item.remainingPercent || 0} height={8} />
            <Text style={[
              styles.percentText,
              { color: item.remainingPercent <= 30 ? COLORS.statusLow : COLORS.textSecondary }
            ]}>
              {item.remainingPercent || 0}%
            </Text>
          </View>

          {/* Bottom info */}
          <View style={styles.bottomRow}>
            {item.estimatedEmptyDate && (
              <Text style={styles.estimateText}>
                Dự kiến hết: {formatDate(item.estimatedEmptyDate)}
              </Text>
            )}
            {item.lastUsedAt && (
              <Text style={styles.usedText}>
                Dùng lần cuối: {formatDate(item.lastUsedAt)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {item.remainingPercent < 100 && (
          <TouchableOpacity
            style={styles.refillBtn}
            onPress={() => onRefill?.(item)}
          >
            <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
            <Text style={styles.refillText}>Bổ sung</Text>
          </TouchableOpacity>
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  name: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  category: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  percentText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    minWidth: 36,
    textAlign: 'right',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  estimateText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  usedText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  refillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary + '10',
    gap: SPACING.xs,
  },
  refillText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
});
