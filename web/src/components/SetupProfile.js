import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupProfile } from '../api';
import './SetupProfile.css';

function SetupProfile({ token, setUser }) {
  const [username, setUsername] = useState('');
  const [category, setCategory] = useState('kreator');
  const [bio, setBio] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('username', username);
    formData.append('category', category);
    formData.append('bio', bio);
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }

    try {
      const response = await setupProfile(formData);
      setUser(response.data.user);
      alert('Profile setup complete!');
      navigate('/');
    } catch (error) {
      alert('Failed to setup profile: ' + error.response?.data?.message);
    }
  };

  return (
    <div className="setup-profile-container">
      <div className="setup-profile-box">
        <h2>Setup Your Profile</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="kreator">Kreator</option>
            <option value="bisnis">Bisnis</option>
            <option value="freelancer">Freelancer</option>
          </select>
          
          <textarea
            placeholder="Bio (optional)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows="4"
          />
          
          <label>Profile Photo:</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProfilePhoto(e.target.files[0])}
          />
          
          <div className="skill-diagram-placeholder">
            <p>Skill Diagram (Placeholder)</p>
          </div>
          
          <button type="submit">Complete Setup</button>
        </form>
      </div>
    </div>
  );
}

export default SetupProfile;
