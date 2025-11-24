import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL
});

let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
};

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
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

export const uploadContent = (formData) => 
  api.post('/content/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const getAllContent = () => 
  api.get('/content/all');

export const createEvent = (eventData) => 
  api.post('/event/create', eventData);

export const getAllEvents = () => 
  api.get('/event/all');

export const getChatList = () => 
  api.get('/chat/list');

export const sendMessage = (messageData) => 
  api.post('/chat/message', messageData);

export const getChatMessages = (chatId) => 
  api.get(`/chat/messages/${chatId}`);

export const searchContent = (query) => 
  api.get(`/search?q=${query}`);

export default api;
