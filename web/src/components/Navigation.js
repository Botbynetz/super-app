import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './Navigation.css';

const Navigation = ({ token, setToken, user }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (!token) return null;

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <h2>SuperApp</h2>
        </div>

        <div className="nav-links">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <i className="fas fa-tachometer-alt"></i>
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink to="/chat" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <i className="fas fa-comments"></i>
            <span>Chat Hub</span>
          </NavLink>
          
          <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <i className="fas fa-user-circle"></i>
            <span>Profile</span>
          </NavLink>
          
          <NavLink to="/content" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <i className="fas fa-video"></i>
            <span>Content Studio</span>
          </NavLink>
          
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <i className="fas fa-cogs"></i>
              <span>Admin</span>
            </NavLink>
          )}
        </div>

        <div className="nav-user">
          <div className="user-info">
            <img 
              src={user?.profilePicture || '/default-avatar.png'} 
              alt={user?.fullName} 
              className="user-avatar"
            />
            <span className="user-name">{user?.fullName || 'User'}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;