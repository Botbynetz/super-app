const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const multer = require('multer');
const path = require('path');
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.mimetype.startsWith('video') ? 'uploads/videos/' : 'uploads/photos/';
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const { caption } = req.body;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const type = req.file.mimetype.startsWith('video') ? 'video' : 'foto';
    const folder = type === 'video' ? 'videos' : 'photos';

    const content = new Content({
      userId,
      type,
      fileUrl: `/uploads/${folder}/${req.file.filename}`,
      caption: caption || ''
    });

    await content.save();

    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const contents = await Content.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('userId', 'username profilePhoto');
    res.json({ contents });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const contents = await Content.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'username profilePhoto');
    res.json({ contents });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
