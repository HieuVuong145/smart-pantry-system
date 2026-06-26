import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from '../constants/theme';

/**
 * Root Index — Splash screen + auth check
 * Checks if user is logged in, redirects accordingly
 */
export default function RootIndex() {
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Small delay for splash feel
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const userId = await SecureStore.getItemAsync('userId');
      if (userId) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    } catch (e) {
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Ionicons name="nutrition-outline" size={56} color={COLORS.textOnPrimary} />
      </View>
      <Text style={styles.title}>Smart Pantry</Text>
      <Text style={styles.subtitle}>Quản lý kho nguyên liệu thông minh</Text>
      <ActivityIndicator 
        size="small" 
        color={COLORS.primary} 
        style={styles.loader} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.extrabold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  loader: {
    marginTop: SPACING.xxxl,
  },
});
