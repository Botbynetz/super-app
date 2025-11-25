import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Badges.css';

const API_URL = 'http://localhost:5000/api';

function Badges() {
  const [progress, setProgress] = useState(null);
  const [allBadges, setAllBadges] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      const [progressRes, badgesRes] = await Promise.all([
        axios.get(`${API_URL}/gamification/progress/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/gamification/badges`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (progressRes.data.success) {
        setProgress(progressRes.data.progress);
      }
      if (badgesRes.data.success) {
        setAllBadges(badgesRes.data.badges);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  if (!progress) {
    return <div className="loading">Loading...</div>;
  }

  const filteredBadges = activeTab === 'all' 
    ? allBadges 
    : allBadges.filter(b => b.type === activeTab);

  return (
    <div className="badges-container">
      <div className="badges-header">
        <h1>Badges & Achievements 🏆</h1>
        <p className="earned-count">
          {progress.badges.length} / {allBadges.length} Earned
        </p>
      </div>

      <div className="progress-section">
        <div className="level-card">
          <div className="level-label">Level</div>
          <div className="level-number">{progress.level}</div>
        </div>
        
        <div className="exp-card">
          <div className="exp-label">Experience Points</div>
          <div className="exp-number">{progress.experiencePoints} XP</div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress.levelProgress}%` }}
            ></div>
          </div>
          <div className="exp-next">Next level: {progress.expForNextLevel} XP</div>
        </div>

        <div className="coins-card">
          <div className="coins-label">Your Coins</div>
          <div className="coins-amount">🪙 {progress.coins}</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{progress.stats.totalLiveStreams}</div>
          <div className="stat-label">Live Streams</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{progress.stats.totalViewers}</div>
          <div className="stat-label">Total Viewers</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{progress.stats.totalGiftsReceived}</div>
          <div className="stat-label">Gifts Received</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{progress.stats.totalEventsJoined}</div>
          <div className="stat-label">Events Joined</div>
        </div>
      </div>

      <div className="badges-section">
        <div className="section-header">
          <h2>All Badges</h2>
          <div className="badge-filters">
            <button 
              className={`filter-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn ${activeTab === 'skill' ? 'active' : ''}`}
              onClick={() => setActiveTab('skill')}
            >
              Skill
            </button>
            <button 
              className={`filter-btn ${activeTab === 'live' ? 'active' : ''}`}
              onClick={() => setActiveTab('live')}
            >
              Live
            </button>
            <button 
              className={`filter-btn ${activeTab === 'event' ? 'active' : ''}`}
              onClick={() => setActiveTab('event')}
            >
              Event
            </button>
            <button 
              className={`filter-btn ${activeTab === 'achievement' ? 'active' : ''}`}
              onClick={() => setActiveTab('achievement')}
            >
              Achievement
            </button>
          </div>
        </div>

        <div className="badges-grid">
          {filteredBadges.map(badge => {
            const earned = progress.badges.some(b => b.badgeId._id === badge._id);
            
            return (
              <div 
                key={badge._id} 
                className={`badge-card ${!earned ? 'locked' : ''} rarity-${badge.rarity}`}
              >
                <div className="badge-icon">
                  {earned ? '🏆' : '🔒'}
                </div>
                <h3 className="badge-name">{badge.name}</h3>
                <p className="badge-description">{badge.description}</p>
                <div className="badge-footer">
                  <span className={`rarity-badge rarity-${badge.rarity}`}>
                    {badge.rarity.toUpperCase()}
                  </span>
                  {badge.coinReward > 0 && (
                    <span className="coin-reward">+{badge.coinReward} 🪙</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Badges;
