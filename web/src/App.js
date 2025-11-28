import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import SetupProfile from './components/SetupProfile';
import Navigation from './components/Navigation';
// Consolidated Hub Components
import Dashboard from './components/Dashboard';
import ChatHub from './components/ChatHub';
import ProfileCenter from './components/ProfileCenter';
import ContentStudio from './components/ContentStudio';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  return (
    <Router>
      <div className="App">
        <Navigation token={token} setToken={setToken} user={user} />
        <div className="app-content">
          <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={
              <div className="auth-page">
                {token ? <Navigate to="/" /> : <Login setToken={setToken} setUser={setUser} />}
              </div>
            } />
            <Route path="/setup-profile" element={
              <div className="auth-page">
                {token ? <SetupProfile token={token} setUser={setUser} /> : <Navigate to="/login" />}
              </div>
            } />
            
            {/* Main Hub Routes - Consolidated UI */}
            <Route path="/" element={
              token ? (
                <div className="component-wrapper">
                  <Dashboard token={token} user={user} setToken={setToken} />
                </div>
              ) : <Navigate to="/login" />
            } />
            <Route path="/dashboard" element={
              token ? (
                <div className="component-wrapper">
                  <Dashboard token={token} user={user} setToken={setToken} />
                </div>
              ) : <Navigate to="/login" />
            } />
            <Route path="/chat" element={
              token ? (
                <div className="component-wrapper">
                  <ChatHub token={token} user={user} />
                </div>
              ) : <Navigate to="/login" />
            } />
            <Route path="/profile" element={
              token ? (
                <div className="component-wrapper">
                  <ProfileCenter token={token} user={user} />
                </div>
              ) : <Navigate to="/login" />
            } />
            <Route path="/profile/:userId" element={
              token ? (
                <div className="component-wrapper">
                  <ProfileCenter token={token} user={user} />
                </div>
              ) : <Navigate to="/login" />
            } />
            <Route path="/content" element={
              token ? (
                <div className="component-wrapper">
                  <ContentStudio token={token} user={user} />
                </div>
              ) : <Navigate to="/login" />
            } />
            <Route path="/creator" element={
              token ? (
                <div className="component-wrapper">
                  <ContentStudio token={token} user={user} />
                </div>
              ) : <Navigate to="/login" />
            } />
            <Route path="/admin" element={
              token ? (
                <div className="component-wrapper">
                  <AdminPanel token={token} user={user} />
                </div>
              ) : <Navigate to="/login" />
            } />
            
            {/* Legacy Route Redirects for Backward Compatibility */}
            <Route path="/home" element={<Navigate to="/dashboard" />} />
            <Route path="/feed" element={<Navigate to="/dashboard" />} />
            <Route path="/analytics" element={<Navigate to="/dashboard" />} />
            <Route path="/wallet" element={<Navigate to="/dashboard" />} />
            <Route path="/social" element={<Navigate to="/profile" />} />
            <Route path="/content-manager" element={<Navigate to="/content" />} />
            <Route path="/creator-tools" element={<Navigate to="/content" />} />
            <Route path="/marketplace" element={<Navigate to="/content" />} />
            <Route path="/my-bookings" element={<Navigate to="/content" />} />
            <Route path="/moderation" element={<Navigate to="/admin" />} />
            <Route path="/user-management" element={<Navigate to="/admin" />} />
            <Route path="/enterprise" element={<Navigate to="/admin" />} />
            <Route path="/content-advanced" element={<Navigate to="/content" />} />
            <Route path="/advanced-analytics" element={<Navigate to="/dashboard" />} />
            <Route path="/performance" element={<Navigate to="/admin" />} />
            <Route path="/api-documentation" element={<Navigate to="/admin" />} />
            <Route path="/backup-management" element={<Navigate to="/admin" />} />
            <Route path="/integration-settings" element={<Navigate to="/admin" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
