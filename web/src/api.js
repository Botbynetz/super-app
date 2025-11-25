import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const sendOTP = (phoneNumber) => 
  api.post('/auth/send-otp', { phoneNumber });

export const verifyOTP = (phoneNumber, otp, autoLogin) => 
  api.post('/auth/verify-otp', { phoneNumber, otp, autoLogin });

export const setupProfile = (formData) => 
  api.post('/user/setup-profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const getProfile = () => 
  api.get('/user/profile');

export const getUserProfile = (userId) => 
  api.get(`/user/profile/${userId}`);

export const uploadContent = (formData) => 
  api.post('/content/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const getUserContent = (userId) => 
  api.get(`/content/user/${userId}`);

export const getAllContent = () => 
  api.get('/content/all');

export const createEvent = (eventData) => 
  api.post('/event/create', eventData);

export const getUserEvents = (userId) => 
  api.get(`/event/user/${userId}`);

export const getAllEvents = () => 
  api.get('/event/all');

export const createChat = (chatData) => 
  api.post('/chat/create', chatData);

export const getChatList = () => 
  api.get('/chat/list');

export const sendMessage = (messageData) => 
  api.post('/chat/message', messageData);

export const getChatMessages = (chatId) => 
  api.get(`/chat/messages/${chatId}`);

export const searchContent = (query) => 
  api.get(`/search?q=${query}`);

export const getAdminUsers = () => 
  api.get('/admin/users');

export const getAdminEvents = () => 
  api.get('/admin/events');

export const getAdminStats = () => 
  api.get('/admin/stats');

// Live Streaming APIs
export const startLiveStream = (streamData) => 
  api.post('/livestream/start', streamData);

export const stopLiveStream = (streamId) => 
  api.post(`/livestream/stop/${streamId}`);

export const getLiveStreams = (category) => 
  api.get('/livestream/list', { params: { category } });

export const getStreamDetails = (streamId) => 
  api.get(`/livestream/${streamId}`);

export const joinStream = (streamId) => 
  api.post(`/livestream/${streamId}/join`);

export const leaveStream = (streamId) => 
  api.post(`/livestream/${streamId}/leave`);

export const sendGift = (streamId, giftType, coinValue) => 
  api.post(`/livestream/${streamId}/gift`, { giftType, coinValue });

export const boostStream = (streamId, durationMinutes) => 
  api.post(`/livestream/${streamId}/boost`, { durationMinutes });

export const getUserStreamHistory = (userId, page = 1, limit = 10) => 
  api.get(`/livestream/user/${userId}/history`, { params: { page, limit } });

// Gamification APIs
export const getUserProgress = (userId) => 
  api.get(`/gamification/progress/${userId}`);

export const getLeaderboard = (type = 'level', limit = 100) => 
  api.get('/gamification/leaderboard', { params: { type, limit } });

export const getAllBadges = (type) => 
  api.get('/gamification/badges', { params: { type } });

export const checkBadges = (userId) => 
  api.post(`/gamification/check-badges/${userId}`);

export const addExperience = (userId, amount, reason) => 
  api.post('/gamification/add-exp', { userId, amount, reason });

export const getUserTransactions = (userId, page = 1, limit = 20) => 
  api.get(`/gamification/transactions/${userId}`, { params: { page, limit } });

export const purchaseCoins = (userId, amount, paymentData) => 
  api.post('/gamification/purchase-coins', { userId, amount, paymentData });

// Chat Improvements
export const markMessagesAsRead = (chatId) => 
  api.post(`/chat/${chatId}/read`);

export const getUserOnlineStatus = (userId) => 
  api.get(`/chat/online-status/${userId}`);

// AI Financial Assistant
export const generateFinancialReport = (userId, month, year) => 
  api.post('/ai/financial-assistant', { userId, month, year });

export const getFinancialReport = (userId, month, year) => 
  api.get(`/ai/financial-report/${userId}`, { params: { month, year } });

export const setFinancialTargets = (userId, month, year, incomeTarget, expenseLimit) => 
  api.post('/ai/financial-targets', { userId, month, year, incomeTarget, expenseLimit });

// AI Product Description Generator
export const generateProductDescription = (productName, category, inputs) => 
  api.post('/ai/product-description', { productName, category, inputs });

export const getProductDescriptions = () => 
  api.get('/ai/product-descriptions');

// AI Chatbot Generator
export const createChatbot = (name, description, flows, defaultResponse, deploymentType) => 
  api.post('/ai/chatbot-generator', { name, description, flows, defaultResponse, deploymentType });

export const getChatbots = () => 
  api.get('/ai/chatbots');

export const sendChatbotMessage = (chatbotId, message) => 
  api.post(`/ai/chatbot/${chatbotId}/message`, { message });

// AI CV Generator
export const generateCV = (templateId, data) => 
  api.post('/ai/generate-cv', { templateId, data });

export const getUserCVs = () => 
  api.get('/ai/cvs');

export const getFreelancerRankings = (skill, limit) => 
  api.get('/ai/freelancer-rankings', { params: { skill, limit } });

// AI Smart Recommendations
export const getEventRecommendations = (limit) => 
  api.get('/ai/recommend/events', { params: { limit } });

export const getContentRecommendations = (limit) => 
  api.get('/ai/recommend/content', { params: { limit } });

export const getStreamRecommendations = (limit) => 
  api.get('/ai/recommend/streams', { params: { limit } });

export const getUserRecommendations = (limit) => 
  api.get('/ai/recommend/users', { params: { limit } });

export const trackInteraction = (itemId, itemType, action) => 
  api.post('/ai/track-interaction', { itemId, itemType, action });

// Notification APIs
export const getNotifications = (page = 1, limit = 20, unreadOnly = false, type) => 
  api.get('/notification', { params: { page, limit, unreadOnly, type } });

export const getUnreadCount = () => 
  api.get('/notification/unread-count');

export const markNotificationAsRead = (notificationId) => 
  api.put(`/notification/${notificationId}/read`);

export const markAllNotificationsAsRead = () => 
  api.put('/notification/read-all');

export const deleteNotification = (notificationId) => 
  api.delete(`/notification/${notificationId}`);

// Featured Live Streams
export const getFeaturedLiveStreams = (limit = 5) => 
  api.get('/livestream/featured', { params: { limit } });

export default api;
