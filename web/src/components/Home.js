import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProfile, uploadContent, createEvent, getAllContent, getAllEvents, searchContent } from '../api';
import './Home.css';

function Home({ token, user, setToken }) {
  const [profile, setProfile] = useState(null);
  const [contents, setContents] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
    loadAllContent();
    loadAllEvents();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await getProfile();
      setProfile(response.data.user);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadAllContent = async () => {
    try {
      const response = await getAllContent();
      setContents(response.data.contents);
    } catch (error) {
      console.error('Failed to load content:', error);
    }
  };

  const loadAllEvents = async () => {
    try {
      const response = await getAllEvents();
      setEvents(response.data.events);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadAllContent();
      loadAllEvents();
      return;
    }
    try {
      const response = await searchContent(searchQuery);
      setContents(response.data.contents);
      setEvents(response.data.events);
    } catch (error) {
      alert('Search failed: ' + error.response?.data?.message);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await uploadContent(formData);
      alert('Content uploaded!');
      setShowUpload(false);
      loadAllContent();
      e.target.reset();
    } catch (error) {
      alert('Upload failed: ' + error.response?.data?.message);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const eventData = {
      title: formData.get('title'),
      description: formData.get('description'),
      date: formData.get('date')
    };
    try {
      await createEvent(eventData);
      alert('Event created!');
      setShowCreateEvent(false);
      loadAllEvents();
      e.target.reset();
    } catch (error) {
      alert('Failed to create event: ' + error.response?.data?.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div>
      <div className="navbar">
        <h2>Super App</h2>
        <nav>
          <Link to="/">Home</Link>
          <Link to={`/profile/${profile._id}`}>Profile</Link>
          <Link to="/chat">Chat</Link>
          <Link to="/admin">Admin</Link>
        </nav>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <div className="container">
        <div className="profile-summary">
          <img src={profile.profilePhoto || 'https://via.placeholder.com/100'} alt="Profile" />
          <div>
            <h3>{profile.username}</h3>
            <p>{profile.category}</p>
            <p>{profile.bio}</p>
          </div>
        </div>

        <div className="search-bar">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search events or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
        </div>

        <div className="actions">
          <button onClick={() => setShowUpload(!showUpload)}>Upload Content</button>
          <button onClick={() => setShowCreateEvent(!showCreateEvent)}>Create Event</button>
        </div>

        {showUpload && (
          <div className="modal">
            <div className="modal-content">
              <h3>Upload Content</h3>
              <form onSubmit={handleUpload}>
                <input type="file" name="file" accept="image/*,video/*" required />
                <input type="text" name="caption" placeholder="Caption (optional)" />
                <button type="submit">Upload</button>
                <button type="button" onClick={() => setShowUpload(false)}>Cancel</button>
              </form>
            </div>
          </div>
        )}

        {showCreateEvent && (
          <div className="modal">
            <div className="modal-content">
              <h3>Create Event</h3>
              <form onSubmit={handleCreateEvent}>
                <input type="text" name="title" placeholder="Event Title" required />
                <textarea name="description" placeholder="Description" required />
                <input type="datetime-local" name="date" required />
                <button type="submit">Create</button>
                <button type="button" onClick={() => setShowCreateEvent(false)}>Cancel</button>
              </form>
            </div>
          </div>
        )}

        <div className="content-section">
          <h3>Content</h3>
          <div className="content-grid">
            {contents.map(content => (
              <div key={content._id} className="content-item">
                {content.type === 'foto' ? (
                  <img src={`http://localhost:5000${content.fileUrl}`} alt="Content" />
                ) : (
                  <video src={`http://localhost:5000${content.fileUrl}`} controls />
                )}
                <p>{content.caption}</p>
                <small>By: {content.userId?.username}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="events-section">
          <h3>Events</h3>
          <div className="events-list">
            {events.map(event => (
              <div key={event._id} className="event-item">
                <h4>{event.title}</h4>
                <p>{event.description}</p>
                <p>Date: {new Date(event.date).toLocaleString()}</p>
                <small>By: {event.userId?.username}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
