const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const validator = require('validator');

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

router.post('/create', auth, async (req, res) => {
  try {
    const { type, participants, groupName } = req.body;
    const userId = req.userId;

    const participantIds = participants.map(p => p.userId || p);
    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
    }

    const participantObjects = participantIds.map(id => ({
      userId: id,
      unreadCount: 0,
      lastSeen: new Date()
    }));

    const chat = new Chat({
      type,
      participants: participantObjects,
      groupName: type === 'group' ? validator.escape(groupName) : undefined
    });

    await chat.save();

    res.json({ success: true, chat });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/list', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const chats = await Chat.find({ 'participants.userId': userId })
      .populate('participants.userId', 'username profilePicture')
      .populate('lastMessage.senderId', 'username')
      .sort({ 'lastMessage.timestamp': -1, createdAt: -1 });
    
    const chatsWithUnread = chats.map(chat => {
      const participant = chat.participants.find(p => p.userId._id.toString() === userId);
      return {
        ...chat.toObject(),
        unreadCount: participant ? participant.unreadCount : 0
      };
    });

    res.json({ chats: chatsWithUnread });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/message', auth, async (req, res) => {
  try {
    const { chatId, text } = req.body;
    const senderId = req.userId;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const sanitizedText = validator.escape(text.trim());

    const message = new Message({
      chatId,
      senderId,
      text: sanitizedText
    });

    await message.save();

    // Update chat last message and unread counts
    const chat = await Chat.findById(chatId);
    chat.lastMessage = {
      text: sanitizedText,
      senderId,
      timestamp: new Date()
    };

    chat.participants.forEach(p => {
      if (p.userId.toString() !== senderId) {
        p.unreadCount += 1;
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'username profilePicture');

    res.json({ success: true, message: populatedMessage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/messages/:chatId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId })
      .populate('senderId', 'username profilePicture')
      .sort({ createdAt: 1 });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/mark-read/:chatId', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const chatId = req.params.chatId;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const participant = chat.participants.find(p => p.userId.toString() === userId);
    if (participant) {
      participant.unreadCount = 0;
      participant.lastSeen = new Date();
      await chat.save();
    }

    await Message.updateMany(
      { chatId, senderId: { $ne: userId }, isRead: false },
      { 
        $set: { isRead: true },
        $push: { readBy: { userId, readAt: new Date() } }
      }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/online-status/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('lastActive isOnline');
    res.json({ 
      isOnline: user?.isOnline || false,
      lastActive: user?.lastActive 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
