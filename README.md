# Super App - Talent Ekonomi MVP

Aplikasi MVP super app talent-ekonomi dengan fitur lengkap Step 1.

## Struktur Proyek

```
super-app/
├── backend/          # Node.js + Express + MongoDB + WebSocket
├── web/             # React Web App
└── mobile/          # React Native Mobile App
```

## Fitur Step 1

1. **Login & Signup**
   - Login dengan nomor HP + OTP (Twilio)
   - Opsi auto-login
   - Validasi nomor & OTP

2. **Setup Profil Dasar**
   - Username, kategori user, bio, foto profil
   - Skill diagram placeholder
   - Tampilan profil user

3. **Upload Konten & Event**
   - Upload foto/video
   - Buat event sederhana
   - Daftar konten & event user

4. **Chat Dasar**
   - Chat pribadi & grup
   - Realtime sync dengan WebSocket
   - UI mirip WhatsApp

5. **AI Search**
   - Cari event atau konten berdasarkan kata kunci

6. **Admin Dashboard**
   - Lihat daftar user & event
   - Statistik sederhana

## Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env dengan credentials Anda
npm start
```

## Setup Web

```bash
cd web
npm install
npm start
```

## Setup Mobile

```bash
cd mobile
npm install
npx react-native run-android
# atau
npx react-native run-ios
```

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, Socket.io, Twilio
- **Web**: React, React Router, Socket.io-client, Axios
- **Mobile**: React Native, React Navigation, Socket.io-client

## Struktur Database (MongoDB)

- **User**: phoneNumber, username, category, bio, profilePhoto, skillDiagram
- **Content**: userId, type (foto/video), fileUrl, caption
- **Event**: userId, title, description, date
- **Chat**: type (private/group), participants, groupName
- **Message**: chatId, senderId, text

## API Endpoints

### Auth
- POST /api/auth/send-otp
- POST /api/auth/verify-otp

### User
- POST /api/user/setup-profile
- GET /api/user/profile
- GET /api/user/profile/:userId

### Content
- POST /api/content/upload
- GET /api/content/user/:userId
- GET /api/content/all

### Event
- POST /api/event/create
- GET /api/event/user/:userId
- GET /api/event/all

### Chat
- POST /api/chat/create
- GET /api/chat/list
- POST /api/chat/message
- GET /api/chat/messages/:chatId

### Search
- GET /api/search?q=keyword

### Admin
- GET /api/admin/users
- GET /api/admin/events
- GET /api/admin/stats

## Siap untuk Phase 2

Struktur modular dan scalable untuk pengembangan lebih lanjut.