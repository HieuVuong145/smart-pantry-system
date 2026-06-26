import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../constants/theme';

/**
 * ProgressBar — Animated progress bar đổi màu theo %
 * 🟢 >50% (xanh) | 🟡 30-50% (vàng) | 🔴 ≤20% (đỏ)
 */
export default function ProgressBar({ percent = 0, height = 10, showGlow = true, style }) {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  const getColor = () => {
    if (clampedPercent > 60) return COLORS.statusFull; // Xanh
    if (clampedPercent > 30) return COLORS.statusHalf; // Vàng (Nguy cơ hết)
    return COLORS.statusLow; // Đỏ (Sắp hết, <=30)
  };

  const color = getColor();

  return (
    <View style={[styles.container, { height }, style]}>
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clampedPercent}%`,
              backgroundColor: color,
              height,
            },
            showGlow && {
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 4,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: BORDER_RADIUS.full,
  },
});
