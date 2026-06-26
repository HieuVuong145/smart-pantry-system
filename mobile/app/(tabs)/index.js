import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform, Modal, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { inventoryAPI, pantryAPI } from '../../services/api';
import EmptyState from '../../components/EmptyState';
import ProgressBar from '../../components/ProgressBar';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, CATEGORY_ICONS, CATEGORY_COLORS } from '../../constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const FAMILY_ID = 'family_001'; // Default family ID for testing

export default function DashboardScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [inventory, setInventory] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    loadUserName();
    fetchInventory();
    fetchPendingReviews();

    // Setup push notifications
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        pantryAPI.sendPushToken(FAMILY_ID, token)
          .catch(err => console.log('❌ Failed to save push token:', err));
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // You could refresh inventory here
      fetchInventory();
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'inventory_alert') {
        router.push('/shopping');
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      try {
        const projectId = 'your-project-id'; // usually automatically picked up in Expo Go
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('Push Token:', token);
      } catch (e) {
        console.log(e);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  const loadUserName = async () => {
    try {
      const name = await SecureStore.getItemAsync('userName');
      setUserName(name || 'Bạn');
    } catch (e) {
      setUserName('Bạn');
    }
  };

  const fetchInventory = async () => {
    try {
      const result = await inventoryAPI.getAll(FAMILY_ID);
      if (result.success) {
        setInventory(result.data || []);
      }
    } catch (error) {
      console.log('Fetch inventory error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingReviews = async () => {
    try {
      const result = await pantryAPI.getPendingAiReviews(FAMILY_ID);
      if (result.success && result.data && result.data.length > 0) {
        setPendingReviews(result.data);
      } else {
        setPendingReviews([]);
      }
    } catch (e) {
      console.log('Fetch pending reviews err:', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInventory();
    await fetchPendingReviews();
    setRefreshing(false);
  }, []);

  const openReviewModal = (review) => {
    // Clone review items so we can edit
    const editableReview = { ...review, items: review.items.map(i => ({...i})) };
    setCurrentReview(editableReview);
    setReviewRating(0);
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setCurrentReview(null);
  };

  const adjustReviewPercent = (index, delta) => {
    const newReview = { ...currentReview };
    let current = newReview.items[index].newPercent;
    current = Math.max(0, Math.min(100, current + delta));
    newReview.items[index].newPercent = current;
    setCurrentReview(newReview);
  };

  const submitReview = async () => {
    if (!currentReview) return;
    setSubmittingReview(true);
    try {
      const adjustedItems = currentReview.items.map(i => ({ itemId: i.itemId, newPercent: i.newPercent }));
      const result = await pantryAPI.confirmAiReview(FAMILY_ID, currentReview.id, reviewRating, adjustedItems);
      if (result.success) {
        setShowReviewModal(false);
        setCurrentReview(null);
        await fetchInventory();
        await fetchPendingReviews();
      }
    } catch (error) {
      console.log('Submit review err:', error);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Compute stats
  const fullItems = inventory.filter(i => i.remainingPercent > 60);
  const halfItems = inventory.filter(i => i.remainingPercent > 30 && i.remainingPercent <= 60);
  const lowItems = inventory.filter(i => i.remainingPercent <= 30 && i.remainingPercent > 0);
  const emptyItems = inventory.filter(i => i.remainingPercent <= 0);
  const mustBuy = [...lowItems, ...emptyItems];
  const shouldBuy = halfItems;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* AI Review Banner */}
      {pendingReviews.length > 0 && (
        <TouchableOpacity 
          style={styles.aiReviewBanner}
          onPress={() => openReviewModal(pendingReviews[0])}
          activeOpacity={0.8}
        >
          <View style={styles.aiReviewIconCircle}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View style={styles.aiReviewContent}>
            <Text style={styles.aiReviewTitle}>Cần xác nhận kết quả AI</Text>
            <Text style={styles.aiReviewDesc}>AI vừa phân tích {pendingReviews[0].items.length} nguyên liệu</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      )}

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.statusFull }]}>
          <Text style={[styles.summaryNumber, { color: COLORS.statusFull }]}>{fullItems.length}</Text>
          <Text style={styles.summaryLabel}>Còn nhiều</Text>
          <View style={[styles.summaryDot, { backgroundColor: COLORS.statusFull }]} />
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.statusHalf }]}>
          <Text style={[styles.summaryNumber, { color: COLORS.statusHalf }]}>{halfItems.length}</Text>
          <Text style={styles.summaryLabel}>Khoảng nửa</Text>
          <View style={[styles.summaryDot, { backgroundColor: COLORS.statusHalf }]} />
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.statusLow }]}>
          <Text style={[styles.summaryNumber, { color: COLORS.statusLow }]}>{mustBuy.length}</Text>
          <Text style={styles.summaryLabel}>Sắp hết</Text>
          <View style={[styles.summaryDot, { backgroundColor: COLORS.statusLow }]} />
        </View>
      </View>

      {/* Quick Scan Button */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => router.push('/(tabs)/scan')}
        activeOpacity={0.8}
      >
        <View style={styles.scanIconCircle}>
          <Ionicons name="camera" size={24} color={COLORS.textOnPrimary} />
        </View>
        <View style={styles.scanTextContainer}>
          <Text style={styles.scanTitle}>Scan nguyên liệu</Text>
          <Text style={styles.scanSubtitle}>Chụp ảnh để AI nhận diện tự động</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
      </TouchableOpacity>

      {/* Must Buy Section */}
      {mustBuy.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: COLORS.statusLow }]} />
              <Text style={styles.sectionTitle}>Cần mua ngay</Text>
            </View>
            <View style={styles.mustBuyBadge}>
              <Text style={styles.mustBuyBadgeText}>{mustBuy.length} items</Text>
            </View>
          </View>
          {mustBuy.map((item) => (
            <View key={item.id} style={styles.alertCard}>
              <View style={styles.alertRow}>
                <View style={[styles.alertIcon, { backgroundColor: (CATEGORY_COLORS[item.category] || COLORS.categoryKhac) + '15' }]}>
                  <Ionicons
                    name={CATEGORY_ICONS[item.category] || 'cube-outline'}
                    size={18}
                    color={CATEGORY_COLORS[item.category] || COLORS.categoryKhac}
                  />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertName}>{item.name}</Text>
                  <ProgressBar percent={item.remainingPercent} height={6} />
                </View>
                <View style={styles.alertPercentBadge}>
                  <Text style={styles.alertPercentText}>{item.remainingPercent}%</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Should Buy Section */}
      {shouldBuy.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: COLORS.statusHalf }]} />
              <Text style={styles.sectionTitle}>Khuyến nghị mua</Text>
            </View>
            <View style={styles.shouldBuyBadge}>
              <Text style={styles.shouldBuyBadgeText}>{shouldBuy.length} items</Text>
            </View>
          </View>
          {shouldBuy.map((item) => (
            <View key={item.id} style={styles.alertCard}>
              <View style={styles.alertRow}>
                <View style={[styles.alertIcon, { backgroundColor: (CATEGORY_COLORS[item.category] || COLORS.categoryKhac) + '15' }]}>
                  <Ionicons
                    name={CATEGORY_ICONS[item.category] || 'cube-outline'}
                    size={18}
                    color={CATEGORY_COLORS[item.category] || COLORS.categoryKhac}
                  />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertName}>{item.name}</Text>
                  <ProgressBar percent={item.remainingPercent} height={6} />
                </View>
                <View style={[styles.alertPercentBadge, { backgroundColor: COLORS.statusHalf + '15' }]}>
                  <Text style={[styles.alertPercentText, { color: COLORS.statusHalf }]}>{item.remainingPercent}%</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Empty state */}
      {inventory.length === 0 && (
        <EmptyState
          icon="snow-outline"
          title="Tủ lạnh trống"
          subtitle="Chụp ảnh hoặc thêm nguyên liệu thủ công để bắt đầu theo dõi"
        />
      )}

      {/* Bottom padding */}
      <View style={{ height: 20 }} />
    </ScrollView>

    {/* AI Review Modal */}
    <Modal visible={showReviewModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🧠 Xác nhận kết quả AI</Text>
            <TouchableOpacity onPress={closeReviewModal}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.reviewIntro}>
              Vui lòng kiểm tra lại mức độ % tồn kho do AI đánh giá và chỉnh sửa nếu cần thiết.
            </Text>

            {currentReview?.items.map((item, index) => (
              <View key={item.itemId} style={styles.reviewItemCard}>
                <Text style={styles.reviewItemName}>{item.name}</Text>
                <View style={styles.reviewItemControls}>
                  <TouchableOpacity style={styles.reviewAdjustBtn} onPress={() => adjustReviewPercent(index, -5)}>
                    <Ionicons name="remove" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                  <View style={styles.reviewPercentBox}>
                    <Text style={styles.reviewPercentText}>{item.newPercent}%</Text>
                  </View>
                  <TouchableOpacity style={styles.reviewAdjustBtn} onPress={() => adjustReviewPercent(index, 5)}>
                    <Ionicons name="add" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Mức độ hài lòng của bạn:</Text>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Ionicons 
                      name={reviewRating >= star ? "star" : "star-outline"} 
                      size={32} 
                      color={reviewRating >= star ? "#FFD700" : COLORS.textTertiary} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.reviewSubmitBtn, submittingReview && {opacity: 0.7}]} 
              onPress={submitReview}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <Text style={styles.reviewSubmitText}>Xác nhận & Lưu</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  userName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  // Summary cards
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    alignItems: 'center',
    borderLeftWidth: 3,
    ...SHADOWS.sm,
  },
  summaryNumber: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.extrabold,
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: SPACING.sm,
  },
  // Scan button
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '30',
    ...SHADOWS.sm,
  },
  scanIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  scanTextContainer: {
    flex: 1,
  },
  scanTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  scanSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  // Sections
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  mustBuyBadge: {
    backgroundColor: COLORS.statusLow + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  mustBuyBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.statusLow,
  },
  shouldBuyBadge: {
    backgroundColor: COLORS.statusHalf + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  shouldBuyBadgeText: {
    color: COLORS.statusHalf,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },

  // AI Review
  aiReviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  aiReviewIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  aiReviewContent: {
    flex: 1,
  },
  aiReviewTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  aiReviewDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  reviewScroll: {
    paddingBottom: SPACING.xl,
  },
  reviewIntro: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  reviewItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reviewItemName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  reviewItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  reviewAdjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPercentBox: {
    width: 50,
    alignItems: 'center',
  },
  reviewPercentText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  ratingSection: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  reviewSubmitBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
  reviewSubmitText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  // Alert cards
  alertCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  alertContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  alertName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
  },
  alertPercentBadge: {
    backgroundColor: COLORS.statusLow + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: SPACING.sm,
  },
  alertPercentText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.statusLow,
  },
});
