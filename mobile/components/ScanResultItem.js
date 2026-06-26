import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/theme';

/**
 * ScanResultItem — Item kết quả AI detect, có confirm/edit/delete
 */
export default function ScanResultItem({
  item,
  confirmed,
  onConfirm,
  onEdit,
  onDelete,
  style,
}) {
  return (
    <View style={[styles.container, confirmed && styles.confirmedContainer, style]}>
      <View style={styles.row}>
        {/* Confirm checkbox */}
        <TouchableOpacity
          style={[styles.confirmBtn, confirmed && styles.confirmedBtn]}
          onPress={() => onConfirm?.(item)}
        >
          <Ionicons
            name={confirmed ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={confirmed ? COLORS.success : COLORS.textTertiary}
          />
        </TouchableOpacity>

        {/* Item info */}
        <View style={styles.content}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.metaRow}>
            {item.nameEn && (
              <Text style={styles.nameEn}>{item.nameEn}</Text>
            )}
            {item.estimatedQuantity && (
              <Text style={styles.quantity}>• {item.estimatedQuantity}</Text>
            )}
          </View>
          {item.confidence && (
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${item.confidence}%`,
                      backgroundColor: item.confidence > 70 ? COLORS.success : COLORS.warning,
                    },
                  ]}
                />
              </View>
              <Text style={styles.confidenceText}>AI: {item.confidence}%</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit?.(item)}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete?.(item)}>
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmedContainer: {
    borderColor: COLORS.success + '40',
    backgroundColor: '#F0FDF4',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmBtn: {
    marginRight: SPACING.md,
  },
  confirmedBtn: {},
  content: {
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  nameEn: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  quantity: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  confidenceText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    fontWeight: FONT_WEIGHT.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  actionBtn: {
    padding: SPACING.xs,
  },
});
