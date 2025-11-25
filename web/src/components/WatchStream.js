import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import './WatchStream.css';

const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

function WatchStream() {
  const { streamId } = useParams();
  const [stream, setStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const socketRef = useRef(null);

  const gifts = [
    { id: 1, name: '❤️', value: 10 },
    { id: 2, name: '🔥', value: 25 },
    { id: 3, name: '💎', value: 50 },
    { id: 4, name: '👑', value: 100 },
    { id: 5, name: '🚀', value: 250 },
  ];

  useEffect(() => {
    fetchStreamDetails();
    joinStream();

    return () => {
      if (socketRef.current) {
        const userId = localStorage.getItem('userId');
        socketRef.current.emit('leave-stream', { streamId, userId });
        socketRef.current.disconnect();
      }
    };
  }, [streamId]);

  const fetchStreamDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/livestream/${streamId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setStream(response.data.stream);
      }
    } catch (error) {
      console.error('Error fetching stream:', error);
    }
  };

  const joinStream = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/livestream/${streamId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const socket = io(SOCKET_URL);
        socketRef.current = socket;

        const userId = localStorage.getItem('userId');
        socket.emit('join-stream', { 
          streamId, 
          rtcRoomId: response.data.rtcRoomId,
          userId
        });

        socket.on('stream-chat-message', (data) => {
          setMessages(prev => [...prev, data]);
        });

        socket.on('stream-gift', (data) => {
          setMessages(prev => [...prev, { type: 'gift', ...data }]);
        });

        socket.on('viewer-joined', (data) => {
          setStream(prev => ({ ...prev, viewerCount: data.viewerCount }));
        });

        socket.on('viewer-left', (data) => {
          setStream(prev => ({ ...prev, viewerCount: data.viewerCount }));
        });
      }
    } catch (error) {
      console.error('Error joining stream:', error);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socketRef.current) {
      const username = localStorage.getItem('username') || 'Anonymous';
      socketRef.current.emit('stream-chat-message', {
        streamId,
        message: message.trim(),
        username
      });
      setMessage('');
    }
  };

  const sendGift = async (gift) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/livestream/${streamId}/gift`, {
        giftType: gift.name,
        coinValue: gift.value
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && socketRef.current) {
        const username = localStorage.getItem('username') || 'Anonymous';
        socketRef.current.emit('stream-gift', {
          streamId,
          gift,
          fromUser: username
        });
        setShowGifts(false);
        alert(`Gift sent! Remaining coins: ${response.data.remainingCoins}`);
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to send gift');
    }
  };

  const handleLike = () => {
    if (socketRef.current) {
      const userId = localStorage.getItem('userId');
      socketRef.current.emit('stream-like', { streamId, userId });
    }
  };

  if (!stream) {
    return <div className="loading">Loading stream...</div>;
  }

  return (
    <div className="watch-stream-container">
      <div className="video-section">
        <div className="video-player">
          <div className="video-placeholder">
            <h2>📹 Live Video Stream</h2>
            <p>WebRTC Integration Required</p>
          </div>
          
          <div className="stream-overlay">
            <div className="live-badge">
              <span className="live-dot"></span>
              <span>LIVE</span>
            </div>
            <div className="viewer-badge">👁 {stream.viewerCount}</div>
          </div>

          <div className="stream-info-overlay">
            <h2>{stream.title}</h2>
            <p>@{stream.userId?.username}</p>
          </div>
        </div>

        <div className="action-buttons">
          <button className="action-btn like-btn" onClick={handleLike}>
            ❤️
          </button>
          <button className="action-btn gift-btn" onClick={() => setShowGifts(!showGifts)}>
            🎁
          </button>
        </div>
      </div>

      <div className="chat-section">
        <div className="chat-header">
          <h3>Live Chat</h3>
        </div>
        
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.type === 'gift' ? 'gift-message' : ''}`}>
              {msg.type === 'gift' ? (
                <span className="gift-text">
                  <strong>{msg.fromUser}</strong> sent {msg.gift.name} ({msg.gift.value} coins)
                </span>
              ) : (
                <span>
                  <strong className="username">{msg.username}:</strong> {msg.message}
                </span>
              )}
            </div>
          ))}
        </div>

        <form className="chat-input" onSubmit={sendMessage}>
          <input
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit">Send</button>
        </form>
      </div>

      {showGifts && (
        <div className="gift-modal">
          <div className="gift-modal-content">
            <h3>Send a Gift 🎁</h3>
            <div className="gifts-grid">
              {gifts.map(gift => (
                <div key={gift.id} className="gift-item" onClick={() => sendGift(gift)}>
                  <span className="gift-emoji">{gift.name}</span>
                  <span className="gift-value">{gift.value} 🪙</span>
                </div>
              ))}
            </div>
            <button className="close-btn" onClick={() => setShowGifts(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WatchStream;
