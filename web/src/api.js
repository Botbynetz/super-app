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

export default api;
