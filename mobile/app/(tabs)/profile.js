import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { getApiBaseUrl, setApiBaseUrl } from '../../services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const name = await SecureStore.getItemAsync('userName');
      const email = await SecureStore.getItemAsync('userEmail');
      setUserName(name || 'Người dùng');
      setUserEmail(email || '');
      setApiUrl(getApiBaseUrl());
    } catch (e) {}
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc muốn đăng xuất?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('userId');
            await SecureStore.deleteItemAsync('userName');
            await SecureStore.deleteItemAsync('userEmail');
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleSaveApiUrl = () => {
    if (apiUrl.trim()) {
      setApiBaseUrl(apiUrl.trim());
      Alert.alert('Đã lưu', 'Server URL đã được cập nhật.');
    }
  };

  const getInitials = () => {
    return userName.charAt(0).toUpperCase();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header with profile */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <View style={styles.onlineDot} />
        </View>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userEmail}>{userEmail}</Text>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Tài khoản</Text>

        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: COLORS.info + '15' }]}>
            <Ionicons name="people-outline" size={20} color={COLORS.info} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Quản lý gia đình</Text>
            <Text style={styles.menuDesc}>Thêm, sửa thành viên</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: COLORS.warning + '15' }]}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.warning} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Thông báo</Text>
            <Text style={styles.menuDesc}>Cài đặt thông báo push</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Settings */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Cài đặt</Text>

        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: COLORS.statusLow + '15' }]}>
            <Ionicons name="speedometer-outline" size={20} color={COLORS.statusLow} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Ngưỡng cảnh báo</Text>
            <Text style={styles.menuDesc}>Sắp hết: ≤20% | Khuyến nghị: ≤50%</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowSettings(!showSettings)}
        >
          <View style={[styles.menuIcon, { backgroundColor: COLORS.primary + '15' }]}>
            <Ionicons name="server-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Server URL</Text>
            <Text style={styles.menuDesc} numberOfLines={1}>{apiUrl}</Text>
          </View>
          <Ionicons
            name={showSettings ? 'chevron-down' : 'chevron-forward'}
            size={20}
            color={COLORS.textTertiary}
          />
        </TouchableOpacity>

        {showSettings && (
          <View style={styles.settingsExpanded}>
            <TextInput
              style={styles.settingsInput}
              value={apiUrl}
              onChangeText={setApiUrl}
              placeholder="http://192.168.x.x:3000/api"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveUrlBtn} onPress={handleSaveApiUrl}>
              <Text style={styles.saveUrlText}>Lưu</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.menuSection}>
        <Text style={styles.menuSectionTitle}>Thông tin</Text>

        <View style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: COLORS.success + '15' }]}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.success} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>Phiên bản</Text>
            <Text style={styles.menuDesc}>Smart Pantry v2.1.0</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // Header
  header: {
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
    ...SHADOWS.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textOnPrimary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.success,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  userName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  // Menu sections
  menuSection: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
  },
  menuSectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  menuDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  // Settings expanded
  settingsExpanded: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    marginTop: -SPACING.xs,
  },
  settingsInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  saveUrlBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveUrlText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xxl,
    paddingVertical: SPACING.base,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.error + '30',
    backgroundColor: COLORS.error + '08',
  },
  logoutText: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.error,
  },
});
