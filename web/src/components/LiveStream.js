import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LiveStream.css';

const API_URL = 'http://localhost:5000/api';

function LiveStream() {
  const [streams, setStreams] = useState([]);
  const [category, setCategory] = useState('all');

  const categories = ['all', 'coding', 'design', 'trading', 'gaming', 'music', 'art', 'education', 'lifestyle'];

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, [category]);

  const fetchStreams = async () => {
    try {
      const query = category !== 'all' ? `?category=${category}` : '';
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/livestream/list${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setStreams(response.data.streams);
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
    }
  };

  return (
    <div className="livestream-container">
      <div className="livestream-header">
        <h1>Live Streams 🔴</h1>
        <button className="go-live-btn" onClick={() => window.location.href = '/start-stream'}>
          Go Live
        </button>
      </div>

      <div className="category-tabs">
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-tab ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="streams-grid">
        {streams.map(stream => (
          <div 
            key={stream._id} 
            className="stream-card"
            onClick={() => window.location.href = `/watch-stream/${stream._id}`}
          >
            <div className="stream-thumbnail">
              <img src={stream.thumbnailUrl || 'https://via.placeholder.com/400x225'} alt={stream.title} />
              {stream.isBoosted && (
                <div className="boost-badge">⚡ BOOSTED</div>
              )}
              <div className="stream-overlay">
                <div className="live-indicator">
                  <span className="live-dot"></span>
                  <span className="live-text">LIVE</span>
                </div>
                <div className="viewer-count">👁 {stream.viewerCount}</div>
              </div>
            </div>
            <div className="stream-info">
              <h3 className="stream-title">{stream.title}</h3>
              <div className="streamer-info">
                <img 
                  src={stream.userId?.profilePicture || 'https://via.placeholder.com/40'} 
                  alt={stream.userId?.username}
                  className="streamer-avatar"
                />
                <span className="streamer-name">{stream.userId?.username}</span>
                <span className="stream-category">{stream.category}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {streams.length === 0 && (
        <div className="no-streams">
          <p>No live streams at the moment</p>
          <button className="start-streaming-btn" onClick={() => window.location.href = '/start-stream'}>
            Be the first to go live! 🚀
          </button>
        </div>
      )}
    </div>
  );
}

export default LiveStream;
