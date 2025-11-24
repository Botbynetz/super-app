import React, { useState, useEffect } from 'react';
import { getAdminUsers, getAdminEvents, getAdminStats } from '../api';
import './Admin.css';

function Admin({ token }) {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    loadStats();
    loadUsers();
    loadEvents();
  }, []);

  const loadStats = async () => {
    try {
      const response = await getAdminStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await getAdminUsers();
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await getAdminEvents();
      setEvents(response.data.events);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  return (
    <div className="admin-container">
      <h2>Admin Dashboard</h2>
      
      <div className="admin-tabs">
        <button 
          className={activeTab === 'stats' ? 'active' : ''} 
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={activeTab === 'events' ? 'active' : ''} 
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
      </div>

      {activeTab === 'stats' && stats && (
        <div className="stats-section">
          <div className="stat-card">
            <h3>Total Users</h3>
            <p className="stat-number">{stats.totalUsers}</p>
          </div>
          <div className="stat-card">
            <h3>Total Events</h3>
            <p className="stat-number">{stats.totalEvents}</p>
          </div>
          <div className="stat-card">
            <h3>Users by Category</h3>
            {stats.usersByCategory.map(cat => (
              <p key={cat._id}>{cat._id}: {cat.count}</p>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="users-section">
          <h3>All Users ({users.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Category</th>
                <th>Phone</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td>{user.username}</td>
                  <td>{user.category}</td>
                  <td>{user.phoneNumber}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="events-section">
          <h3>All Events ({events.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Creator</th>
                <th>Date</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event._id}>
                  <td>{event.title}</td>
                  <td>{event.userId?.username}</td>
                  <td>{new Date(event.date).toLocaleDateString()}</td>
                  <td>{new Date(event.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Admin;
