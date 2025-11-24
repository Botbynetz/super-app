const express = require('express');
const router = express.Router();
const User = require('../models/User');
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
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/setup-profile', auth, upload.single('profilePhoto'), async (req, res) => {
  try {
    const { username, category, bio } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = username;
    user.category = category;
    user.bio = bio || '';
    user.skillDiagram = { skills: [], placeholder: true };
    
    if (req.file) {
      user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
    }

    await user.save();

    res.json({ 
      success: true, 
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        username: user.username,
        category: user.category,
        bio: user.bio,
        profilePhoto: user.profilePhoto,
        skillDiagram: user.skillDiagram
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-otp -otpExpiry');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-otp -otpExpiry -phoneNumber');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
