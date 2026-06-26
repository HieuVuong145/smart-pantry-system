import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants/theme';

/**
 * CategoryFilter — Horizontal scroll filter tabs
 */

const CATEGORIES = [
  { key: 'all', label: 'Tất cả', icon: 'grid-outline' },
  ...Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key,
    label,
    icon: CATEGORY_ICONS[key],
    color: CATEGORY_COLORS[key],
  })),
];

export default function CategoryFilter({ selected = 'all', onSelect, style }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.container, style]}
      contentContainerStyle={styles.contentContainer}
    >
      {CATEGORIES.map((cat) => {
        const isActive = selected === cat.key;
        const activeColor = cat.color || COLORS.primary;

        return (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.tab,
              isActive && { backgroundColor: activeColor + '15', borderColor: activeColor },
            ]}
            onPress={() => onSelect?.(cat.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={cat.icon}
              size={16}
              color={isActive ? activeColor : COLORS.textTertiary}
            />
            <Text
              style={[
                styles.tabText,
                isActive && { color: activeColor, fontWeight: FONT_WEIGHT.semibold },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 50,
  },
  contentContainer: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
    marginRight: SPACING.sm,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
});
