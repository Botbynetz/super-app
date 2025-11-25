import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Leaderboard.css';

const API_URL = 'http://localhost:5000/api';

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [type, setType] = useState('level');

  const types = [
    { id: 'level', label: 'Level Rankings' },
    { id: 'viewers', label: 'Most Viewers' },
    { id: 'streamer', label: 'Top Streamers' },
    { id: 'gifter', label: 'Top Gifters' }
  ];

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [type]);

  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/gamification/leaderboard?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setLeaderboard(response.data.leaderboard);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const getDisplayValue = (item) => {
    switch (type) {
      case 'level':
        return `Level ${item.level}`;
      case 'viewers':
        return `${item.stats.totalViewers.toLocaleString()} viewers`;
      case 'streamer':
        return `${item.stats.totalLiveStreams} streams`;
      case 'gifter':
        return `${item.stats.totalGiftsSent.toLocaleString()} 🪙`;
      default:
        return '';
    }
  };

  const getRankColor = (index) => {
    if (index === 0) return '#f39c12';
    if (index === 1) return '#95a5a6';
    if (index === 2) return '#cd7f32';
    return '#3498db';
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h1>Leaderboard 🏆</h1>
        <p>Top performers in the community</p>
      </div>

      <div className="type-tabs">
        {types.map(t => (
          <button
            key={t.id}
            className={`type-tab ${type === t.id ? 'active' : ''}`}
            onClick={() => setType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {leaderboard.length > 0 && (
        <div className="top-three">
          {leaderboard.slice(0, 3).map((item, index) => (
            <div key={index} className={`podium-item rank-${index + 1}`}>
              <div className="medal">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
              </div>
              <img 
                src={item.userId?.profilePicture || 'https://via.placeholder.com/80'} 
                alt={item.userId?.username}
                className="podium-avatar"
              />
              <h3 className="podium-name">{item.userId?.username}</h3>
              <p className="podium-value">{getDisplayValue(item)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="leaderboard-list">
        {leaderboard.map((item, index) => (
          <div key={index} className="leaderboard-item">
            <div 
              className="rank-badge"
              style={{ backgroundColor: getRankColor(index) }}
            >
              #{index + 1}
            </div>
            <img 
              src={item.userId?.profilePicture || 'https://via.placeholder.com/50'} 
              alt={item.userId?.username}
              className="user-avatar"
            />
            <div className="user-info">
              <h4 className="user-name">{item.userId?.username}</h4>
              <p className="user-value">{getDisplayValue(item)}</p>
            </div>
            {index < 3 && (
              <div className="medal-icon">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
              </div>
            )}
          </div>
        ))}
      </div>

      {leaderboard.length === 0 && (
        <div className="no-data">
          <p>No leaderboard data available yet</p>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
