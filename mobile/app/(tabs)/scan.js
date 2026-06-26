import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Modal, TextInput, Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { pantryAPI, inventoryAPI, mealAPI } from '../../services/api';
import ScanResultItem from '../../components/ScanResultItem';
import EmptyState from '../../components/EmptyState';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, CATEGORY_LABELS } from '../../constants/theme';

const FAMILY_ID = 'family_001';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState([]);
  const [confirmedItems, setConfirmedItems] = useState(new Set());
  const [action, setAction] = useState('put_in');
  const [saving, setSaving] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('khac');
  const cameraRef = useRef(null);

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });
      setCapturedImage(photo);
      setShowCamera(false);
      analyzePhoto(photo.base64);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chụp ảnh: ' + error.message);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0]);
      analyzePhoto(result.assets[0].base64);
    }
  };

  const analyzePhoto = async (base64) => {
    setAnalyzing(true);
    setResults([]);
    setConfirmedItems(new Set());
    try {
      const result = await pantryAPI.capture(base64, FAMILY_ID);
      if (result.success && result.aiResult?.items) {
        setResults(result.aiResult.items.map((item, idx) => ({
          ...item,
          id: `ai_${idx}`,
          source: 'ai',
        })));
        if (result.aiResult.action) {
          setAction(result.aiResult.action === 'took_out' ? 'took_out' : 'put_in');
        }
      } else {
        setResults([]);
      }
    } catch (error) {
      Alert.alert('Lỗi phân tích', error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleConfirm = (item) => {
    const next = new Set(confirmedItems);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.add(item.id);
    }
    setConfirmedItems(next);
  };

  const handleEdit = (item) => {
    Alert.prompt?.(
      'Sửa tên',
      `Tên hiện tại: ${item.name}`,
      (newName) => {
        if (newName) {
          setResults(prev =>
            prev.map(r => r.id === item.id ? { ...r, name: newName } : r)
          );
        }
      }
    ) || Alert.alert('Sửa tên', 'Tính năng sửa tên sẽ được cập nhật.');
  };

  const handleDeleteResult = (item) => {
    setResults(prev => prev.filter(r => r.id !== item.id));
    const next = new Set(confirmedItems);
    next.delete(item.id);
    setConfirmedItems(next);
  };

  const handleManualAdd = () => {
    if (!manualName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên nguyên liệu.');
      return;
    }
    const newItem = {
      id: `manual_${Date.now()}`,
      name: manualName.trim(),
      category: manualCategory,
      source: 'manual',
      estimatedQuantity: '1',
    };
    setResults(prev => [...prev, newItem]);
    setConfirmedItems(prev => new Set(prev).add(newItem.id));
    setManualName('');
    setShowManualAdd(false);
  };

  const handleSaveAll = async () => {
    const itemsToSave = results.filter(r => confirmedItems.has(r.id));
    if (itemsToSave.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng xác nhận ít nhất 1 nguyên liệu.');
      return;
    }

    setSaving(true);
    try {
      for (const item of itemsToSave) {
        await inventoryAPI.add({
          familyId: FAMILY_ID,
          name: item.name,
          category: item.category || 'khac',
          unit: item.estimatedQuantity || 'phần',
        });
      }

      // If action is 'took_out', offer to create a meal record
      if (action === 'took_out') {
        Alert.alert(
          'Tạo bữa ăn?',
          `Bạn vừa lấy ra ${itemsToSave.length} nguyên liệu. Tạo bữa ăn với các nguyên liệu này?`,
          [
            { text: 'Bỏ qua', onPress: resetScan },
            {
              text: 'Tạo bữa ăn',
              onPress: async () => {
                try {
                  const ingredients = itemsToSave.map(item => ({
                    name: item.name,
                    category: item.category || 'khac',
                    quantity: item.estimatedQuantity || '1',
                  }));
                  await mealAPI.create({
                    familyId: FAMILY_ID,
                    ingredients,
                  });
                  Alert.alert('Thành công', 'Đã tạo bữa ăn và cập nhật kho nguyên liệu.', [
                    { text: 'OK', onPress: resetScan },
                  ]);
                } catch (error) {
                  Alert.alert('Lỗi tạo bữa ăn', error.message);
                  resetScan();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Thành công',
          `Đã lưu ${itemsToSave.length} nguyên liệu vào kho.`,
          [{ text: 'OK', onPress: resetScan }]
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetScan = () => {
    setCapturedImage(null);
    setResults([]);
    setConfirmedItems(new Set());
    setAction('put_in');
  };

  // Camera permission not granted
  if (!permission?.granted && !permission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  // Show Camera full screen
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          <View style={styles.cameraOverlay}>
            <TouchableOpacity
              style={styles.cameraCloseBtn}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            <View style={styles.cameraBottomBar}>
              <TouchableOpacity style={styles.galleryBtn} onPress={handlePickImage}>
                <Ionicons name="images-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
              <View style={{ width: 48 }} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan nguyên liệu</Text>
        <Text style={styles.headerSubtitle}>
          Chụp ảnh để AI nhận diện hoặc thêm thủ công
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image preview */}
        {capturedImage && (
          <View style={styles.imagePreview}>
            <Image
              source={{ uri: capturedImage.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <TouchableOpacity style={styles.retakeBtn} onPress={resetScan}>
              <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
              <Text style={styles.retakeBtnText}>Chụp lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scan buttons (when no image) */}
        {!capturedImage && !analyzing && (
          <View style={styles.scanOptions}>
            <TouchableOpacity
              style={styles.scanOptionCard}
              onPress={async () => {
                if (!permission?.granted) {
                  const result = await requestPermission();
                  if (!result.granted) {
                    Alert.alert('Cần quyền camera', 'Vui lòng cho phép truy cập camera.');
                    return;
                  }
                }
                setShowCamera(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.scanOptionIcon, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="camera" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.scanOptionTitle}>Chụp ảnh</Text>
              <Text style={styles.scanOptionDesc}>Mở camera để chụp nguyên liệu</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scanOptionCard}
              onPress={handlePickImage}
              activeOpacity={0.7}
            >
              <View style={[styles.scanOptionIcon, { backgroundColor: COLORS.info + '15' }]}>
                <Ionicons name="images" size={32} color={COLORS.info} />
              </View>
              <Text style={styles.scanOptionTitle}>Chọn từ ảnh</Text>
              <Text style={styles.scanOptionDesc}>Chọn ảnh có sẵn trong thư viện</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Analyzing indicator */}
        {analyzing && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.analyzingText}>🤖 AI đang phân tích ảnh...</Text>
            <Text style={styles.analyzingSubtext}>Đang nhận diện nguyên liệu</Text>
          </View>
        )}

        {/* Results */}
        {results.length > 0 && !analyzing && (
          <View style={styles.resultsSection}>
            {/* Action picker */}
            <View style={styles.actionPicker}>
              <Text style={styles.actionLabel}>Hành động:</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionBtn, action === 'put_in' && styles.actionBtnActive]}
                  onPress={() => setAction('put_in')}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={18}
                    color={action === 'put_in' ? COLORS.textOnPrimary : COLORS.primary}
                  />
                  <Text style={[styles.actionBtnText, action === 'put_in' && styles.actionBtnTextActive]}>
                    Bỏ vào tủ
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, action === 'took_out' && styles.actionBtnActive]}
                  onPress={() => setAction('took_out')}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={18}
                    color={action === 'took_out' ? COLORS.textOnPrimary : COLORS.primary}
                  />
                  <Text style={[styles.actionBtnText, action === 'took_out' && styles.actionBtnTextActive]}>
                    Lấy ra dùng
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Results header */}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                Kết quả ({results.length} nguyên liệu)
              </Text>
              <Text style={styles.confirmedCount}>
                ✓ {confirmedItems.size} đã xác nhận
              </Text>
            </View>

            {/* Result items */}
            {results.map((item) => (
              <ScanResultItem
                key={item.id}
                item={item}
                confirmed={confirmedItems.has(item.id)}
                onConfirm={() => toggleConfirm(item)}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDeleteResult(item)}
              />
            ))}

            {/* Manual add button */}
            <TouchableOpacity
              style={styles.manualAddBtn}
              onPress={() => setShowManualAdd(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.manualAddText}>Thêm nguyên liệu thủ công</Text>
            </TouchableOpacity>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveAll}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.textOnPrimary} />
                  <Text style={styles.saveBtnText}>Xác nhận & Lưu ({confirmedItems.size} items)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Empty results after analyze */}
        {results.length === 0 && capturedImage && !analyzing && (
          <View>
            <EmptyState
              icon="scan-outline"
              title="Không phát hiện nguyên liệu"
              subtitle="AI không nhận diện được. Hãy thêm thủ công bên dưới."
            />
            <TouchableOpacity
              style={styles.manualAddBtn}
              onPress={() => setShowManualAdd(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.manualAddText}>Thêm nguyên liệu thủ công</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Manual Add Modal */}
      <Modal visible={showManualAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm thủ công</Text>
              <TouchableOpacity onPress={() => setShowManualAdd(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Tên nguyên liệu *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="VD: Nước mắm, Cà chua..."
              placeholderTextColor={COLORS.textTertiary}
              value={manualName}
              onChangeText={setManualName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Phân loại</Text>
            <View style={styles.categoryGrid}>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.categoryOption,
                    manualCategory === key && styles.categoryOptionActive,
                  ]}
                  onPress={() => setManualCategory(key)}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    manualCategory === key && styles.categoryOptionTextActive,
                  ]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleManualAdd}>
              <Text style={styles.submitBtnText}>Thêm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Camera
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: SPACING.xl,
  },
  cameraCloseBtn: {
    alignSelf: 'flex-start',
    marginTop: 40,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 30,
  },
  galleryBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
  },
  // Image preview
  imagePreview: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
  },
  retakeBtnText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  // Scan options
  scanOptions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  scanOptionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  scanOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  scanOptionTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  scanOptionDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Analyzing
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  analyzingText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  analyzingSubtext: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  // Results
  resultsSection: {
    marginBottom: SPACING.xl,
  },
  actionPicker: {
    marginBottom: SPACING.lg,
  },
  actionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  actionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  actionBtnTextActive: {
    color: COLORS.textOnPrimary,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  resultsTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  confirmedCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.medium,
  },
  manualAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.base,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
    marginVertical: SPACING.md,
  },
  manualAddText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 52,
    marginTop: SPACING.md,
    ...SHADOWS.md,
    shadowColor: COLORS.primary,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  categoryOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  categoryOptionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
  },
  categoryOptionTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  submitBtnText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
  },
});
