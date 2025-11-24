const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

router.post('/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      user = new User({ phoneNumber, otp, otpExpiry, username: `user_${Date.now()}` });
    } else {
      user.otp = otp;
      user.otpExpiry = otpExpiry;
    }
    
    await user.save();

    await client.messages.create({
      body: `Your OTP is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, autoLogin } = req.body;
    
    const user = await User.findOne({ phoneNumber });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    user.isVerified = true;
    user.autoLogin = autoLogin || false;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({ 
      success: true, 
      token, 
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        username: user.username,
        category: user.category,
        bio: user.bio,
        profilePhoto: user.profilePhoto
      },
      isNewUser: !user.category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
