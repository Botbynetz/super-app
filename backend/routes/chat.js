const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

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

    if (!participants.includes(userId)) {
      participants.push(userId);
    }

    const chat = new Chat({
      type,
      participants,
      groupName: type === 'group' ? groupName : undefined
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
    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'username profilePhoto')
      .sort({ createdAt: -1 });
    res.json({ chats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/message', auth, async (req, res) => {
  try {
    const { chatId, text } = req.body;
    const senderId = req.userId;

    const message = new Message({
      chatId,
      senderId,
      text
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'username profilePhoto');

    res.json({ success: true, message: populatedMessage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/messages/:chatId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId })
      .populate('senderId', 'username profilePhoto')
      .sort({ createdAt: 1 });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
