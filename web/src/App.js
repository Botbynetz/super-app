import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import SetupProfile from './components/SetupProfile';
import Home from './components/Home';
import Profile from './components/Profile';
import Chat from './components/Chat';
import Admin from './components/Admin';
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
        <Routes>
          <Route path="/login" element={
            token ? <Navigate to="/" /> : <Login setToken={setToken} setUser={setUser} />
          } />
          <Route path="/setup-profile" element={
            token ? <SetupProfile token={token} setUser={setUser} /> : <Navigate to="/login" />
          } />
          <Route path="/" element={
            token ? <Home token={token} user={user} setToken={setToken} /> : <Navigate to="/login" />
          } />
          <Route path="/profile/:userId" element={
            token ? <Profile token={token} /> : <Navigate to="/login" />
          } />
          <Route path="/chat" element={
            token ? <Chat token={token} /> : <Navigate to="/login" />
          } />
          <Route path="/admin" element={
            token ? <Admin token={token} /> : <Navigate to="/login" />
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
