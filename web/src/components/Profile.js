import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getUserProfile, getUserContent, getUserEvents } from '../api';
import './Profile.css';

function Profile({ token }) {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [contents, setContents] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadProfile();
    loadContent();
    loadEvents();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const response = await getUserProfile(userId);
      setProfile(response.data.user);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadContent = async () => {
    try {
      const response = await getUserContent(userId);
      setContents(response.data.contents);
    } catch (error) {
      console.error('Failed to load content:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await getUserEvents(userId);
      setEvents(response.data.events);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={profile.profilePhoto || 'https://via.placeholder.com/150'} alt="Profile" />
        <div>
          <h2>{profile.username}</h2>
          <p>{profile.category}</p>
          <p>{profile.bio}</p>
        </div>
      </div>

      <div className="skill-diagram">
        <h3>Skills</h3>
        <div className="skill-placeholder">
          <p>Skill Diagram (Placeholder)</p>
        </div>
      </div>

      <div className="user-content">
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
            </div>
          ))}
        </div>
      </div>

      <div className="user-events">
        <h3>Events</h3>
        <div className="events-list">
          {events.map(event => (
            <div key={event._id} className="event-item">
              <h4>{event.title}</h4>
              <p>{event.description}</p>
              <p>Date: {new Date(event.date).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Profile;
