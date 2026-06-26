import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Smart Pantry API Service
 * Centralized API calls to backend
 */

// Auto-detect server URL
// For iPhone testing via Expo Go, use your computer's LAN IP
// Replace this with your actual LAN IP when testing
const DEV_API_URL = Platform.select({
  ios: 'http://YOUR_LAN_IP:3001/api',      // LAN IP cho test trên máy thật
  android: 'http://10.0.2.2:3001/api',       // Android emulator
  default: 'http://localhost:3001/api',
});

const API_BASE = __DEV__ ? DEV_API_URL : 'https://your-production-server.com/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — add auth token if available
api.interceptors.request.use(async (config) => {
  try {
    const userId = await SecureStore.getItemAsync('userId');
    if (userId) {
      config.headers['X-User-Id'] = userId;
    }
  } catch (e) {
    // SecureStore not available
  }
  return config;
});

// Response interceptor — handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message 
      || error.response?.data?.error 
      || error.message 
      || 'Có lỗi xảy ra';
    return Promise.reject(new Error(message));
  }
);

// ==================== AUTH ====================

export const authAPI = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),

  register: (name, email, password) => 
    api.post('/auth/register', { name, email, password }),
};

// ==================== INVENTORY ====================

export const inventoryAPI = {
  getAll: (familyId) => 
    api.get(`/inventory/family/${familyId}`),

  getByCategory: (familyId, category) => 
    api.get(`/inventory/family/${familyId}/category/${category}`),

  getLowStock: (familyId) => 
    api.get(`/inventory/family/${familyId}/low-stock`),

  getDefaults: () => 
    api.get('/inventory/defaults'),

  add: (item) => 
    api.post('/inventory', item),

  update: (itemId, data) => 
    api.put(`/inventory/${itemId}`, data),

  refill: (itemId) => 
    api.post(`/inventory/${itemId}/refill`),

  remove: (itemId) => 
    api.delete(`/inventory/${itemId}`),
};

// ==================== PANTRY / CAMERA ====================

export const pantryAPI = {
  capture: (imageBase64, familyId, wakeReason, cameraIp = null, motionEvent = 'motion_detected') => 
    api.post('/pantry/capture', { 
      imageBase64, 
      familyId, 
      wakeReason, 
      motionEvent,
      cameraIp,
      deviceId: 'mobile_app' 
    }),

  getLogs: (familyId, limit = 20) => 
    api.get(`/pantry/logs/${familyId}?limit=${limit}`),

  getLogDetail: (logId) => 
    api.get(`/pantry/logs/detail/${logId}`),

  getDevice: (deviceId) => 
    api.get(`/pantry/device/${deviceId}`),

  getGallery: (familyId, limit = 20) =>
    api.get(`/pantry/gallery/${familyId}?limit=${limit}`),

  sendPushToken: (familyId, token) =>
    api.post('/pantry/push-token', { familyId, token }),

  // Human-in-the-Loop: Vật thể cần người dùng định nghĩa
  getUndefinedItems: (familyId) =>
    api.get(`/pantry/undefined-items/${familyId}`),

  getUndefinedItemImage: (familyId, itemId) =>
    `${api.defaults.baseURL}/pantry/undefined-items/${familyId}/${itemId}/image`,

  defineItem: (familyId, undefinedItemId, name, category, description) =>
    api.post('/pantry/define-item', { familyId, undefinedItemId, name, category, description }),

  getDefinitions: (familyId) =>
    api.get(`/pantry/definitions/${familyId}`),

  // Human-in-the-Loop: AI Review
  getPendingAiReviews: (familyId) =>
    api.get(`/pantry/ai-reviews/${familyId}`),

  confirmAiReview: (familyId, reviewId, rating, adjustedItems) =>
    api.post(`/pantry/ai-reviews/${familyId}/${reviewId}/confirm`, { rating, adjustedItems }),
};

// ==================== SHOPPING ====================

export const shoppingAPI = {
  generate: (familyId) => 
    api.post(`/shopping/generate/${familyId}`),

  getCurrent: (familyId) => 
    api.get(`/shopping/current/${familyId}`),

  markBought: (listId, itemName) => 
    api.put(`/shopping/${listId}/bought`, { itemName }),

  addItem: (listId, itemName, quantity, priority) => 
    api.post(`/shopping/${listId}/items`, { itemName, quantity, priority }),

  removeItem: (listId, itemName) => 
    api.delete(`/shopping/${listId}/items/${itemName}`),

  getHistory: (familyId, limit = 10) => 
    api.get(`/shopping/history/${familyId}?limit=${limit}`),

  deleteList: (listId) => 
    api.delete(`/shopping/${listId}`),
};

// ==================== FAMILY ====================

export const familyAPI = {
  getAll: (userId) => 
    api.get(`/families/user/${userId}`),

  getById: (familyId) => 
    api.get(`/families/${familyId}`),

  create: (data) => 
    api.post('/families', data),

  addMember: (familyId, member) => 
    api.post(`/families/${familyId}/members`, member),
};

// ==================== MEALS ====================

export const mealAPI = {
  create: (data) =>
    api.post('/meals', data),

  getAll: (familyId, limit = 30, dateFrom, dateTo) => {
    let url = `/meals/${familyId}?limit=${limit}`;
    if (dateFrom) url += `&dateFrom=${dateFrom}`;
    if (dateTo) url += `&dateTo=${dateTo}`;
    return api.get(url);
  },

  getDetail: (mealId) =>
    api.get(`/meals/detail/${mealId}`),

  update: (mealId, data) =>
    api.put(`/meals/${mealId}`, data),

  delete: (mealId) =>
    api.delete(`/meals/${mealId}`),

  getStats: (familyId, days = 7) =>
    api.get(`/meals/${familyId}/stats?days=${days}`),
};

// ==================== CAMERA ====================

export const cameraAPI = {
  getDeviceInfo: (deviceId) =>
    api.get(`/pantry/device/${deviceId}`),

  updateCameraIp: (deviceId, ip) =>
    api.put(`/pantry/device/${deviceId}/ip`, { ip }),

  getCameraFrame: (deviceId) =>
    api.get(`/pantry/device/${deviceId}/camera-frame`, { responseType: 'arraybuffer' }),
};

// ==================== HELPERS ====================

/**
 * Update the API base URL (for settings screen)
 */
export function setApiBaseUrl(url) {
  api.defaults.baseURL = url;
}

/**
 * Get current API base URL
 */
export function getApiBaseUrl() {
  return api.defaults.baseURL;
}

export default api;
