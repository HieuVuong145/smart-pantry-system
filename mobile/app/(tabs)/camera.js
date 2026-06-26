import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert, Image, Dimensions,
  Modal, TextInput, ImageBackground, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cameraAPI, pantryAPI } from '../../services/api';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, CATEGORY_LABELS } from '../../constants/theme';

const DEVICE_ID = 'device_001';
const FAMILY_ID = 'family_001';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CameraScreen() {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Human-in-the-Loop: Vật thể chờ định nghĩa
  const [undefinedItems, setUndefinedItems] = useState([]);
  const [showDefineModal, setShowDefineModal] = useState(false);
  const [definingItem, setDefiningItem] = useState(null);
  const [defineName, setDefineName] = useState('');
  const [defineCategory, setDefineCategory] = useState('gia_vi');
  const [defineDescription, setDefineDescription] = useState('');
  const [savingDefinition, setSavingDefinition] = useState(false);

  useEffect(() => {
    fetchDeviceInfo();
    fetchGallery();
    fetchUndefinedItems();
  }, []);

  const fetchDeviceInfo = async () => {
    try {
      const result = await cameraAPI.getDeviceInfo(DEVICE_ID);
      if (result.success) {
        setDevice(result.data);
      }
    } catch (error) {
      console.log('Device info error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGallery = async () => {
    setLoadingGallery(true);
    try {
      const result = await pantryAPI.getGallery(FAMILY_ID, 20);
      if (result.success) {
        setGallery(result.data || []);
      }
    } catch (error) {
      console.log('Gallery error:', error.message);
    } finally {
      setLoadingGallery(false);
    }
  };

  const fetchUndefinedItems = async () => {
    try {
      const result = await pantryAPI.getUndefinedItems(FAMILY_ID);
      if (result.success) {
        setUndefinedItems(result.data || []);
      }
    } catch (error) {
      console.log('Undefined items error:', error.message);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeviceInfo();
    await fetchGallery();
    await fetchUndefinedItems();
    setRefreshing(false);
  }, []);

  const openDefineModal = (item) => {
    setDefiningItem(item);
    setDefineName('');
    setDefineCategory(item.category || 'gia_vi');
    setDefineDescription(item.description || '');
    setShowDefineModal(true);
  };

  const handleDefineItem = async () => {
    if (!defineName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên nguyên liệu.');
      return;
    }

    setSavingDefinition(true);
    try {
      const result = await pantryAPI.defineItem(
        FAMILY_ID,
        definingItem.id,
        defineName.trim(),
        defineCategory,
        defineDescription.trim()
      );

      if (result.success) {
        Alert.alert(
          'Thành công! 🎉',
          result.message,
          [{ text: 'OK' }]
        );
        setShowDefineModal(false);
        setDefiningItem(null);
        // Refresh danh sách
        fetchUndefinedItems();
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setSavingDefinition(false);
    }
  };



  const getStatusColor = () => {
    if (!device) return COLORS.textTertiary;
    if (device.status === 'online') return COLORS.success;
    if (device.status === 'deep_sleep') return COLORS.warning;
    return COLORS.error;
  };

  const getStatusText = () => {
    if (!device) return 'Không xác định';
    if (device.status === 'online') return 'Đang hoạt động';
    if (device.status === 'deep_sleep') return 'Đang ngủ sâu';
    return 'Ngoại tuyến';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Camera thiết bị</Text>
        <Text style={styles.headerSubtitle}>
          Xem trực tiếp từ ESP32-CAM
        </Text>
      </View>

      {/* 🔔 Banner: Vật thể cần định nghĩa */}
      {undefinedItems.length > 0 && (
        <View style={styles.undefinedBanner}>
          <View style={styles.undefinedBannerHeader}>
            <View style={styles.undefinedBannerLeft}>
              <Ionicons name="alert-circle" size={22} color={COLORS.warning} />
              <Text style={styles.undefinedBannerTitle}>
                {undefinedItems.length} vật thể cần bạn định nghĩa
              </Text>
            </View>
            <TouchableOpacity onPress={fetchUndefinedItems}>
              <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.undefinedBannerDesc}>
            AI không nhận diện được một số vật thể. Hãy cho AI biết đó là gì!
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.undefinedList}>
            {undefinedItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.undefinedCard}
                onPress={() => openDefineModal(item)}
                activeOpacity={0.7}
              >
                {item.hasImage && (
                  <Image
                    source={{ uri: pantryAPI.getUndefinedItemImage(FAMILY_ID, item.id) }}
                    style={styles.undefinedCardImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.undefinedCardInfo}>
                  <Text style={styles.undefinedCardName} numberOfLines={1}>
                    {item.originalName}
                  </Text>
                  {item.description ? (
                    <Text style={styles.undefinedCardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.undefinedCardBtn}>
                    <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.undefinedCardBtnText}>Định nghĩa</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Camera Preview */}
      <View style={styles.cameraSection}>
        <View style={styles.cameraPreview}>
          {gallery.length > 0 ? (
            <>
              <Image
                source={{ uri: `data:image/jpeg;base64,${gallery[0].imageBase64}` }}
                style={styles.cameraImage}
                resizeMode="cover"
              />
              <View style={styles.latestBadge}>
                <Text style={styles.latestBadgeText}>Ảnh mới nhất</Text>
              </View>
            </>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Ionicons name="images-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.placeholderText}>
                Chưa có ảnh nào
              </Text>
              <Text style={styles.placeholderHint}>
                Ảnh sẽ xuất hiện khi thiết bị thức dậy
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Device Status Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trạng thái thiết bị</Text>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <View>
                <Text style={styles.statusLabel}>Trạng thái</Text>
                <Text style={[styles.statusValue, { color: getStatusColor() }]}>
                  {getStatusText()}
                </Text>
              </View>
            </View>

            <View style={styles.statusItem}>
              <Ionicons name="wifi-outline" size={20} color={COLORS.textSecondary} />
              <View>
                <Text style={styles.statusLabel}>IP Camera</Text>
                <Text style={styles.statusValue}>
                  {device?.cameraIp || 'Chưa cập nhật'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons name="camera-outline" size={20} color={COLORS.textSecondary} />
              <View>
                <Text style={styles.statusLabel}>Ảnh đã chụp</Text>
                <Text style={styles.statusValue}>{device?.photoCount || 0}</Text>
              </View>
            </View>

            <View style={styles.statusItem}>
              <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
              <View>
                <Text style={styles.statusLabel}>Hoạt động lần cuối</Text>
                <Text style={styles.statusValue}>{formatTime(device?.lastActive)}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>



      {/* Photo Gallery */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ảnh đã chụp</Text>
        </View>
        {loadingGallery ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.xl }} />
        ) : gallery.length === 0 ? (
          <View style={styles.emptyGallery}>
            <Ionicons name="images-outline" size={40} color={COLORS.textTertiary} />
            <Text style={styles.emptyGalleryText}>Chưa có ảnh nào</Text>
            <Text style={styles.emptyGalleryHint}>Ảnh sẽ xuất hiện khi PIR phát hiện chuyển động</Text>
          </View>
        ) : (
          <View style={styles.galleryContainer}>
            {Object.entries(
              gallery.reduce((acc, photo) => {
                const dateObj = new Date(photo.timestamp);
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                let dateKey = '';
                if (dateObj.toDateString() === today.toDateString()) {
                  dateKey = 'Hôm nay';
                } else if (dateObj.toDateString() === yesterday.toDateString()) {
                  dateKey = 'Hôm qua';
                } else {
                  dateKey = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }

                if (!acc[dateKey]) acc[dateKey] = [];
                acc[dateKey].push(photo);
                return acc;
              }, {})
            ).map(([dateLabel, photos]) => (
              <View key={dateLabel} style={styles.galleryGroup}>
                <Text style={styles.galleryDateLabel}>{dateLabel}</Text>
                <View style={styles.galleryGrid}>
                  {photos.map((photo) => (
                    <TouchableOpacity
                      key={photo.id}
                      style={styles.galleryItem}
                      onPress={() => setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${photo.imageBase64}` }}
                        style={styles.galleryImage}
                        resizeMode="cover"
                      />
                      <View style={styles.galleryOverlay}>
                        <Text style={styles.galleryTime}>
                          {new Date(photo.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {photo.triggerType === 'pir' && (
                          <View style={styles.pirBadge}>
                            <Ionicons name="walk-outline" size={10} color="#fff" />
                          </View>
                        )}
                      </View>

                      {/* Expanded detail */}
                      {selectedPhoto?.id === photo.id && (
                        <View style={styles.galleryDetail}>
                          <Text style={styles.galleryDetailDate}>
                            {new Date(photo.timestamp).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            {' '}
                            {new Date(photo.timestamp).toLocaleTimeString('vi-VN')}
                          </Text>
                          <Text style={styles.galleryDetailTrigger}>
                            Trigger: {photo.triggerType === 'pir' ? '👋 Phát hiện chuyển động' : '📷 Chụp thủ công'}
                          </Text>
                          {photo.detectedItems?.length > 0 && (
                            <Text style={styles.galleryDetailItems}>
                              🥬 {photo.detectedItems.join(', ')}
                            </Text>
                          )}
                          {photo.aiAnalysis ? (
                            <Text style={styles.galleryDetailAi} numberOfLines={3}>
                              🤖 {photo.aiAnalysis}
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Tips */}
      <View style={styles.section}>
        <View style={styles.tipCard}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.info} />
          <Text style={styles.tipText}>
            Điện thoại và ESP32-CAM phải kết nối cùng một mạng WiFi để xem live stream. 
            Khi cảm biến PIR phát hiện chuyển động, camera sẽ tự động chụp và gửi lên server.
          </Text>
        </View>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>

    {/* Modal định nghĩa vật thể */}
    <Modal visible={showDefineModal} transparent animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <View style={styles.defineModalOverlay}>
        <View style={[styles.defineModalContent, { maxHeight: '90%', paddingBottom: 0 }]}>
          <View style={styles.defineModalHeader}>
            <Text style={styles.defineModalTitle}>🧠 Dạy AI nhận biết</Text>
            <TouchableOpacity onPress={() => setShowDefineModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, paddingTop: 10 }} keyboardShouldPersistTaps="handled">

          {/* Hiện hình ảnh và vùng đánh dấu (bounding box) */}
          {definingItem?.hasImage && (
            <View style={styles.defineModalImageWrapper}>
              <ImageBackground
                source={{ uri: pantryAPI.getUndefinedItemImage(FAMILY_ID, definingItem.id) }}
                style={styles.defineModalImageBg}
              >
                {definingItem.boundingBox && definingItem.boundingBox.length === 4 && (
                  <View
                    style={[
                      styles.boundingBox,
                      {
                        top: `${definingItem.boundingBox[0] / 10}%`,
                        left: `${definingItem.boundingBox[1] / 10}%`,
                        height: `${(definingItem.boundingBox[2] - definingItem.boundingBox[0]) / 10}%`,
                        width: `${(definingItem.boundingBox[3] - definingItem.boundingBox[1]) / 10}%`,
                      }
                    ]}
                  />
                )}
              </ImageBackground>
            </View>
          )}

          {/* Hiện mô tả AI đã thấy */}
          {definingItem && (
            <View style={styles.defineAiInfo}>
              <Ionicons name="eye-outline" size={18} color={COLORS.info} />
              <View style={{ flex: 1 }}>
                <Text style={styles.defineAiLabel}>AI nhìn thấy:</Text>
                <Text style={styles.defineAiText}>{definingItem.originalName}</Text>
                {definingItem.description ? (
                  <Text style={styles.defineAiDesc}>{definingItem.description}</Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Form nhập */}
          <Text style={styles.defineInputLabel}>Tên nguyên liệu thực tế *</Text>
          <TextInput
            style={styles.defineInput}
            placeholder="Ví dụ: Muối biển, Đường phèn, Bột nêm..."
            placeholderTextColor={COLORS.textTertiary}
            value={defineName}
            onChangeText={setDefineName}
            autoFocus
          />

          <Text style={styles.defineInputLabel}>Mô tả (tuỳ chọn)</Text>
          <TextInput
            style={[styles.defineInput, { height: 60 }]}
            placeholder="Ví dụ: Lọ thuỷ tinh nắp xanh, chai nhựa đỏ..."
            placeholderTextColor={COLORS.textTertiary}
            value={defineDescription}
            onChangeText={setDefineDescription}
            multiline
          />

          <Text style={styles.defineInputLabel}>Phân loại</Text>
          <View style={styles.defineCategoryGrid}>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.defineCategoryOption,
                  defineCategory === key && styles.defineCategoryOptionActive,
                ]}
                onPress={() => setDefineCategory(key)}
              >
                <Text style={[
                  styles.defineCategoryText,
                  defineCategory === key && styles.defineCategoryTextActive,
                ]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.defineSubmitBtn, savingDefinition && { opacity: 0.7 }]}
            onPress={handleDefineItem}
            disabled={savingDefinition}
          >
            {savingDefinition ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.textOnPrimary} />
                <Text style={styles.defineSubmitText}>Lưu & Dạy AI</Text>
              </>
            )}
          </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
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
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.base,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  // Camera section
  cameraSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  cameraPreview: {
    backgroundColor: '#000',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
    position: 'relative',
    ...SHADOWS.md,
  },
  cameraImage: {
    width: '100%',
    height: '100%',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  placeholderText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  placeholderHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    textAlign: 'center',
    opacity: 0.7,
  },
  latestBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  latestBadgeText: {
    color: '#fff',
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  // Sections
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  // Status card
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginBottom: 2,
  },
  statusValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  statusDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
  },
  // Info card
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  // Tip card
  tipCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.info + '10',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
    gap: SPACING.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.info + '20',
  },
  tipText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  // Gallery
  emptyGallery: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  emptyGalleryText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
    fontWeight: FONT_WEIGHT.medium,
  },
  emptyGalleryHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
    opacity: 0.7,
  },
  galleryContainer: {
    gap: SPACING.lg,
  },
  galleryGroup: {
    marginBottom: SPACING.md,
  },
  galleryDateLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  galleryGrid: {
    gap: SPACING.md,
  },
  galleryItem: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  galleryImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  galleryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  galleryTime: {
    color: '#fff',
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
  pirBadge: {
    backgroundColor: COLORS.warning,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryDetail: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  galleryDetailDate: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  galleryDetailTrigger: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  galleryDetailItems: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.medium,
  },
  galleryDetailAi: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // ==================== Undefined Items Banner ====================
  undefinedBanner: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.warning + '12',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  undefinedBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  undefinedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  undefinedBannerTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.warning,
  },
  undefinedBannerDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  undefinedList: {
    marginHorizontal: -SPACING.xs,
  },
  undefinedCard: {
    width: 160,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginHorizontal: SPACING.xs,
    ...SHADOWS.sm,
  },
  undefinedCardImage: {
    width: '100%',
    height: 90,
    backgroundColor: COLORS.surfaceSecondary,
  },
  undefinedCardInfo: {
    padding: SPACING.sm,
    gap: 4,
  },
  undefinedCardName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  undefinedCardDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  undefinedCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  undefinedCardBtnText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  // ==================== Define Modal ====================
  defineModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  defineModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    maxHeight: '85%',
  },
  defineModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  defineModalImageWrapper: {
    width: '100%',
    aspectRatio: 4 / 3, // Tỉ lệ ảnh từ ESP32-CAM
    backgroundColor: '#000',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  defineModalImageBg: {
    width: '100%',
    height: '100%',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // Màu đỏ trong suốt
    borderRadius: 4,
  },
  defineModalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  defineAiInfo: {
    flexDirection: 'row',
    backgroundColor: COLORS.info + '10',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.info + '20',
  },
  defineAiLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  defineAiText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  defineAiDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  defineInputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  defineInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  defineCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  defineCategoryOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  defineCategoryOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  defineCategoryText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  defineCategoryTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  defineSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 52,
    marginTop: SPACING.xl,
    ...SHADOWS.md,
    shadowColor: COLORS.primary,
  },
  defineSubmitText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
  },
});
