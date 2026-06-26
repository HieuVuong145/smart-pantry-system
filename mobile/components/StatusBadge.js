import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/theme';

/**
 * StatusBadge — Badge "Còn nhiều" / "Sắp hết" / "Bắt buộc mua"
 */

const STATUS_CONFIG = {
  full: {
    label: 'Còn nhiều',
    color: COLORS.statusFull,
    bg: '#DCFCE7',
    icon: '✓',
  },
  medium: {
    label: 'Khoảng nửa',
    color: COLORS.statusHalf,
    bg: '#FEF3C7',
    icon: '⚠',
  },
  low: {
    label: 'Sắp hết',
    color: COLORS.statusLow,
    bg: '#FEE2E2',
    icon: '!',
  },
  critical: {
    label: 'Bắt buộc mua',
    color: COLORS.statusLow,
    bg: '#FEE2E2',
    icon: '!!',
  },
  empty: {
    label: 'Đã hết',
    color: COLORS.statusEmpty,
    bg: '#F3F4F6',
    icon: '✕',
  },
};

export default function StatusBadge({ status = 'full', size = 'md', style }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.full;
  const isSmall = size === 'sm';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.bg },
      isSmall && styles.badgeSmall,
      style,
    ]}>
      <Text style={[
        styles.badgeText,
        { color: config.color },
        isSmall && styles.badgeTextSmall,
      ]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  badgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  badgeTextSmall: {
    fontSize: FONT_SIZE.xs,
  },
});
