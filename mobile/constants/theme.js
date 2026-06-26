/**
 * Smart Pantry — Design System Constants
 * Theme kho nguyên liệu / Pantry rack — Teal/Emerald
 */

export const COLORS = {
  // Primary brand
  primary: '#0D9488',
  primaryLight: '#14B8A6',
  primaryDark: '#0F766E',
  primaryGradientStart: '#0D9488',
  primaryGradientEnd: '#065F46',

  // Status colors — mức nguyên liệu
  statusFull: '#22C55E',       // >50% — Còn nhiều
  statusHalf: '#F59E0B',       // 30-50% — Khoảng nửa
  statusLow: '#EF4444',        // ≤20% — Sắp hết
  statusEmpty: '#9CA3AF',      // 0% — Hết

  // Backgrounds
  background: '#F0FDFA',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  surfaceSecondary: '#F1F5F9',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textOnPrimary: '#FFFFFF',
  textOnDark: '#E2E8F0',

  // UI elements
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.5)',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Shadows
  shadowLight: 'rgba(13, 148, 136, 0.06)',
  shadowMedium: 'rgba(13, 148, 136, 0.12)',
  shadowDark: 'rgba(15, 23, 42, 0.15)',

  // Priority badges
  priorityHigh: '#EF4444',
  priorityMedium: '#F59E0B',
  priorityLow: '#22C55E',

  // Category colors
  categoryGiaVi: '#F97316',
  categoryThitCa: '#EF4444',
  categoryRauCu: '#22C55E',
  categorySuaTrung: '#3B82F6',
  categoryDoUong: '#8B5CF6',
  categoryDoDongLanh: '#06B6D4',
  categoryDoKho: '#A16207',
  categoryTraiCay: '#FBBF24',
  categoryKhac: '#6B7280',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  title: 32,
};

export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Status thresholds
export const STATUS_THRESHOLDS = {
  FULL: 50,       // >50% = còn nhiều
  HALF: 30,       // 30-50% = khoảng nửa
  LOW: 20,        // 10-30% = ít
  CRITICAL: 10,   // ≤10% = sắp hết
};

// Category labels in Vietnamese
export const CATEGORY_LABELS = {
  gia_vi: 'Gia vị',
  thit_ca: 'Thịt cá',
  rau_cu: 'Rau củ',
  sua_trung: 'Sữa trứng',
  do_uong: 'Đồ uống',
  do_dong_lanh: 'Đồ đông lạnh',
  do_kho: 'Đồ khô',
  trai_cay: 'Trái cây',
  khac: 'Khác',
};

// Category icons (Ionicons names)
export const CATEGORY_ICONS = {
  gia_vi: 'flask-outline',
  thit_ca: 'fish-outline',
  rau_cu: 'leaf-outline',
  sua_trung: 'egg-outline',
  do_uong: 'water-outline',
  do_dong_lanh: 'snow-outline',
  do_kho: 'bag-outline',
  trai_cay: 'nutrition-outline',
  khac: 'cube-outline',
};

// Category colors mapping
export const CATEGORY_COLORS = {
  gia_vi: COLORS.categoryGiaVi,
  thit_ca: COLORS.categoryThitCa,
  rau_cu: COLORS.categoryRauCu,
  sua_trung: COLORS.categorySuaTrung,
  do_uong: COLORS.categoryDoUong,
  do_dong_lanh: COLORS.categoryDoDongLanh,
  do_kho: COLORS.categoryDoKho,
  trai_cay: COLORS.categoryTraiCay,
  khac: COLORS.categoryKhac,
};
