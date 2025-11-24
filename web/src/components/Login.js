import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../api';
import './Login.css';

function Login({ setToken, setUser }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [autoLogin, setAutoLogin] = useState(false);
  const navigate = useNavigate();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    try {
      await sendOTP(phoneNumber);
      setStep(2);
      alert('OTP sent to your phone!');
    } catch (error) {
      alert('Failed to send OTP: ' + error.response?.data?.message);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    try {
      const response = await verifyOTP(phoneNumber, otp, autoLogin);
      setToken(response.data.token);
      setUser(response.data.user);
      
      if (response.data.isNewUser) {
        navigate('/setup-profile');
      } else {
        navigate('/');
      }
    } catch (error) {
      alert('Failed to verify OTP: ' + error.response?.data?.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Super App</h1>
        <h2>Talent Ekonomi</h2>
        
        {step === 1 ? (
          <form onSubmit={handleSendOTP}>
            <h3>Login / Sign Up</h3>
            <input
              type="tel"
              placeholder="Enter phone number (e.g., +62812...)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
            <button type="submit">Send OTP</button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <h3>Enter OTP</h3>
            <p>OTP sent to {phoneNumber}</p>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength="6"
              required
            />
            <label>
              <input
                type="checkbox"
                checked={autoLogin}
                onChange={(e) => setAutoLogin(e.target.checked)}
              />
              Remember me (Auto-login)
            </label>
            <button type="submit">Verify OTP</button>
            <button type="button" onClick={() => setStep(1)}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
