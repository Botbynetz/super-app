import React, { useState, useEffect, useCallback } from 'react';
import './ProfileCenter.css';

const ProfileCenter = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    age: '',
    education: '',
    workExperience: '',
    skills: [],
    interests: [],
    location: '',
    bio: '',
    avatar: null,
    socialLinks: {
      linkedin: '',
      github: '',
      twitter: '',
      instagram: ''
    },
    badges: [],
    skillDiagram: [],
    privacySettings: {
      profileVisibility: 'public',
      showEmail: false,
      showLocation: true
    },
    preferences: {
      notifications: true,
      emailUpdates: false,
      darkMode: true
    }
  });
  
  const [skills] = useState([
    'JavaScript', 'Python', 'React', 'Node.js', 'AI/ML', 'Data Science',
    'UX/UI Design', 'Project Management', 'Marketing', 'Finance',
    'Photography', 'Writing', 'Public Speaking', 'Leadership'
  ]);

  const [interests] = useState([
    'Technology', 'Science', 'Art', 'Music', 'Sports', 'Travel',
    'Cooking', 'Reading', 'Gaming', 'Fitness', 'Nature', 'Education'
  ]);

  const [availableBadges] = useState([
    { id: 'early-adopter', name: 'Early Adopter', icon: '🚀', description: 'Among the first users' },
    { id: 'content-creator', name: 'Content Creator', icon: '✍️', description: '50+ posts created' },
    { id: 'community-helper', name: 'Community Helper', icon: '🤝', description: 'Helped 100+ users' },
    { id: 'ai-enthusiast', name: 'AI Enthusiast', icon: '🤖', description: 'Active AI chat user' },
    { id: 'social-butterfly', name: 'Social Butterfly', icon: '🦋', description: '500+ connections' },
    { id: 'skill-master', name: 'Skill Master', icon: '🏆', description: '10+ verified skills' },
    { id: 'mentor', name: 'Mentor', icon: '👨‍🏫', description: 'Mentored 25+ people' },
    { id: 'innovator', name: 'Innovator', icon: '💡', description: 'Suggested accepted features' }
  ]);

  const [profileProgress, setProfileProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [skillLevel, setSkillLevel] = useState(1);

  const calculateProfileProgress = useCallback(() => {
    const fields = [
      userProfile.name,
      userProfile.email,
      userProfile.bio,
      userProfile.location,
      userProfile.skills.length > 0,
      userProfile.interests.length > 0,
      userProfile.avatar !== null
    ];
    const completedFields = fields.filter(field => field).length;
    const progress = (completedFields / fields.length) * 100;
    setProfileProgress(progress);
  }, [userProfile]);

  useEffect(() => {
    calculateProfileProgress();
  }, [calculateProfileProgress]);

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setUserProfile(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setUserProfile(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSkillToggle = (skill) => {
    setUserProfile(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const handleInterestToggle = (interest) => {
    setUserProfile(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const addCustomSkill = () => {
    if (newSkill && !userProfile.skills.includes(newSkill)) {
      const skillData = {
        name: newSkill,
        level: skillLevel,
        verified: false,
        category: 'custom'
      };
      
      setUserProfile(prev => ({
        ...prev,
        skillDiagram: [...prev.skillDiagram, skillData]
      }));
      
      handleSkillToggle(newSkill);
      setNewSkill('');
      setSkillLevel(1);
      setShowSkillModal(false);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUserProfile(prev => ({
          ...prev,
          avatar: event.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      alert('Error updating profile');
    }
  };

  const renderProfileTab = () => (
    <div className="profile-content">
      <div className="profile-header">
        <div className="avatar-section">
          <div className="avatar-container">
            {userProfile.avatar ? (
              <img src={userProfile.avatar} alt="Avatar" className="user-avatar" />
            ) : (
              <div className="default-avatar">
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : '👤'}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="avatar-input"
              id="avatar-upload"
            />
            <label htmlFor="avatar-upload" className="avatar-upload-btn">
              📷
            </label>
          </div>
          <div className="profile-progress">
            <div className="progress-circle">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${profileProgress}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="percentage">{Math.round(profileProgress)}%</div>
            </div>
            <span className="progress-label">Profile Complete</span>
          </div>
        </div>
        
        <div className="profile-actions">
          <button 
            className={`btn ${isEditing ? 'btn-success' : 'btn-primary'}`}
            onClick={() => isEditing ? saveProfile() : setIsEditing(true)}
          >
            {isEditing ? 'Save Changes' : 'Edit Profile'}
          </button>
          {isEditing && (
            <button 
              className="btn btn-secondary"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="profile-form">
        <div className="form-section">
          <h3>Basic Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={!isEditing}
                placeholder="Enter your full name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={userProfile.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={!isEditing}
                placeholder="Enter your email"
              />
            </div>
            <div className="form-group">
              <label>Age</label>
              <input
                type="number"
                value={userProfile.age}
                onChange={(e) => handleInputChange('age', e.target.value)}
                disabled={!isEditing}
                placeholder="Enter your age"
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={userProfile.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                disabled={!isEditing}
                placeholder="Enter your location"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>About</h3>
          <div className="form-group">
            <label>Bio</label>
            <textarea
              value={userProfile.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              disabled={!isEditing}
              placeholder="Tell us about yourself..."
              rows={4}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Professional</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Education</label>
              <input
                type="text"
                value={userProfile.education}
                onChange={(e) => handleInputChange('education', e.target.value)}
                disabled={!isEditing}
                placeholder="Your education background"
              />
            </div>
            <div className="form-group">
              <label>Work Experience</label>
              <input
                type="text"
                value={userProfile.workExperience}
                onChange={(e) => handleInputChange('workExperience', e.target.value)}
                disabled={!isEditing}
                placeholder="Your work experience"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Skills</h3>
          <div className="skills-container">
            {skills.map(skill => (
              <button
                key={skill}
                className={`skill-tag ${userProfile.skills.includes(skill) ? 'selected' : ''}`}
                onClick={() => isEditing && handleSkillToggle(skill)}
                disabled={!isEditing}
              >
                {skill}
              </button>
            ))}
            {isEditing && (
              <button
                className="skill-tag add-skill"
                onClick={() => setShowSkillModal(true)}
              >
                + Add Skill
              </button>
            )}
          </div>
        </div>

        <div className="form-section">
          <h3>Interests</h3>
          <div className="interests-container">
            {interests.map(interest => (
              <button
                key={interest}
                className={`interest-tag ${userProfile.interests.includes(interest) ? 'selected' : ''}`}
                onClick={() => isEditing && handleInterestToggle(interest)}
                disabled={!isEditing}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSocialTab = () => (
    <div className="social-content">
      <div className="social-header">
        <h3>Social Links</h3>
        <p>Connect your social media profiles</p>
      </div>
      
      <div className="social-links">
        {Object.entries(userProfile.socialLinks).map(([platform, url]) => (
          <div key={platform} className="social-link-item">
            <div className="social-icon">
              {platform === 'linkedin' && '💼'}
              {platform === 'github' && '🐙'}
              {platform === 'twitter' && '🐦'}
              {platform === 'instagram' && '📸'}
            </div>
            <div className="social-info">
              <label>{platform.charAt(0).toUpperCase() + platform.slice(1)}</label>
              <input
                type="url"
                value={url}
                onChange={(e) => handleInputChange(`socialLinks.${platform}`, e.target.value)}
                disabled={!isEditing}
                placeholder={`Your ${platform} profile URL`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="social-preview">
        <h4>Preview</h4>
        <div className="social-card">
          <div className="social-card-avatar">
            {userProfile.avatar ? (
              <img src={userProfile.avatar} alt="Avatar" />
            ) : (
              <div className="default-avatar">
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : '👤'}
              </div>
            )}
          </div>
          <div className="social-card-info">
            <h4>{userProfile.name || 'Your Name'}</h4>
            <p>{userProfile.bio || 'Your bio will appear here...'}</p>
            <div className="social-card-links">
              {Object.entries(userProfile.socialLinks).map(([platform, url]) => (
                url && (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="social-link">
                    {platform === 'linkedin' && '💼'}
                    {platform === 'github' && '🐙'}
                    {platform === 'twitter' && '🐦'}
                    {platform === 'instagram' && '📸'}
                  </a>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBadgesTab = () => (
    <div className="badges-content">
      <div className="badges-header">
        <h3>Achievement Badges</h3>
        <p>Your accomplishments and milestones</p>
      </div>

      <div className="earned-badges">
        <h4>Earned Badges ({userProfile.badges.length})</h4>
        <div className="badges-grid">
          {userProfile.badges.map(badgeId => {
            const badge = availableBadges.find(b => b.id === badgeId);
            return badge ? (
              <div key={badge.id} className="badge-card earned">
                <div className="badge-icon">{badge.icon}</div>
                <h5>{badge.name}</h5>
                <p>{badge.description}</p>
                <div className="badge-date">Earned: Oct 2024</div>
              </div>
            ) : null;
          })}
        </div>
      </div>

      <div className="available-badges">
        <h4>Available Badges</h4>
        <div className="badges-grid">
          {availableBadges.filter(badge => !userProfile.badges.includes(badge.id)).map(badge => (
            <div key={badge.id} className="badge-card available">
              <div className="badge-icon locked">{badge.icon}</div>
              <h5>{badge.name}</h5>
              <p>{badge.description}</p>
              <div className="badge-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{width: `${Math.random() * 80 + 10}%`}}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="badge-stats">
        <div className="stat-item">
          <span className="stat-number">{userProfile.badges.length}</span>
          <span className="stat-label">Badges Earned</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{availableBadges.length - userProfile.badges.length}</span>
          <span className="stat-label">To Unlock</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{Math.round((userProfile.badges.length / availableBadges.length) * 100)}%</span>
          <span className="stat-label">Complete</span>
        </div>
      </div>
    </div>
  );

  const renderSkillDiagramTab = () => (
    <div className="skill-diagram-content">
      <div className="skill-diagram-header">
        <h3>Skills Dashboard</h3>
        <p>Visual representation of your expertise</p>
      </div>

      <div className="skill-categories">
        <div className="skill-category">
          <h4>Technical Skills</h4>
          <div className="skill-bars">
            {userProfile.skills.filter(skill => 
              ['JavaScript', 'Python', 'React', 'Node.js', 'AI/ML', 'Data Science'].includes(skill)
            ).map(skill => (
              <div key={skill} className="skill-bar-item">
                <div className="skill-info">
                  <span>{skill}</span>
                  <span>{Math.floor(Math.random() * 3) + 3}/5</span>
                </div>
                <div className="skill-bar">
                  <div 
                    className="skill-fill"
                    style={{width: `${(Math.floor(Math.random() * 3) + 3) * 20}%`}}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="skill-category">
          <h4>Soft Skills</h4>
          <div className="skill-radial">
            {userProfile.skills.filter(skill => 
              ['Leadership', 'Public Speaking', 'Project Management'].includes(skill)
            ).map((skill, index) => (
              <div key={skill} className="radial-skill">
                <div className="radial-chart">
                  <svg viewBox="0 0 36 36" className="circular-chart">
                    <path
                      className="circle-bg"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="circle"
                      strokeDasharray={`${(index + 3) * 20}, 100`}
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="percentage">{(index + 3) * 20}%</div>
                </div>
                <span className="skill-name">{skill}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="skill-category">
          <h4>Creative Skills</h4>
          <div className="skill-hexagon">
            {userProfile.skills.filter(skill => 
              ['UX/UI Design', 'Photography', 'Writing'].includes(skill)
            ).map((skill, index) => (
              <div key={skill} className="hex-skill">
                <div className="hex-container">
                  <div className="hex-bg"></div>
                  <div className="hex-content">
                    <span className="hex-percentage">{(index + 2) * 25}%</span>
                  </div>
                </div>
                <span className="skill-name">{skill}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="skill-recommendations">
        <h4>Skill Recommendations</h4>
        <div className="recommendation-cards">
          <div className="recommendation-card">
            <div className="rec-icon">🎯</div>
            <h5>Suggested Skills</h5>
            <p>Based on your profile: TypeScript, Docker, AWS</p>
            <button className="btn btn-outline">Explore</button>
          </div>
          <div className="recommendation-card">
            <div className="rec-icon">📈</div>
            <h5>Trending Skills</h5>
            <p>Hot in your field: Machine Learning, Blockchain, Cloud</p>
            <button className="btn btn-outline">Learn More</button>
          </div>
          <div className="recommendation-card">
            <div className="rec-icon">🏆</div>
            <h5>Certifications</h5>
            <p>Verify your skills with industry certifications</p>
            <button className="btn btn-outline">Get Certified</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="settings-content">
      <div className="settings-header">
        <h3>Privacy & Preferences</h3>
        <p>Manage your account settings and privacy</p>
      </div>

      <div className="settings-sections">
        <div className="settings-section">
          <h4>Privacy Settings</h4>
          <div className="setting-item">
            <div className="setting-info">
              <label>Profile Visibility</label>
              <span>Who can see your profile</span>
            </div>
            <select
              value={userProfile.privacySettings.profileVisibility}
              onChange={(e) => handleInputChange('privacySettings.profileVisibility', e.target.value)}
            >
              <option value="public">Public</option>
              <option value="friends">Friends Only</option>
              <option value="private">Private</option>
            </select>
          </div>
          
          <div className="setting-item">
            <div className="setting-info">
              <label>Show Email</label>
              <span>Display email on profile</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={userProfile.privacySettings.showEmail}
                onChange={(e) => handleInputChange('privacySettings.showEmail', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Show Location</label>
              <span>Display location on profile</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={userProfile.privacySettings.showLocation}
                onChange={(e) => handleInputChange('privacySettings.showLocation', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h4>Preferences</h4>
          <div className="setting-item">
            <div className="setting-info">
              <label>Push Notifications</label>
              <span>Receive push notifications</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={userProfile.preferences.notifications}
                onChange={(e) => handleInputChange('preferences.notifications', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Email Updates</label>
              <span>Receive email notifications</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={userProfile.preferences.emailUpdates}
                onChange={(e) => handleInputChange('preferences.emailUpdates', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Dark Mode</label>
              <span>Use dark theme</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={userProfile.preferences.darkMode}
                onChange={(e) => handleInputChange('preferences.darkMode', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h4>Account Actions</h4>
          <div className="action-buttons">
            <button className="btn btn-primary">Export Data</button>
            <button className="btn btn-secondary">Download Profile</button>
            <button className="btn btn-warning">Deactivate Account</button>
            <button className="btn btn-danger">Delete Account</button>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'social', name: 'Social', icon: '🌐' },
    { id: 'badges', name: 'Badges', icon: '🏆' },
    { id: 'skills', name: 'Skills', icon: '🎯' },
    { id: 'settings', name: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="profile-center">
      <div className="profile-sidebar">
        <div className="profile-sidebar-header">
          <h2>Profile Center</h2>
        </div>
        <nav className="profile-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-text">{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="profile-main">
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'social' && renderSocialTab()}
        {activeTab === 'badges' && renderBadgesTab()}
        {activeTab === 'skills' && renderSkillDiagramTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>

      {/* Skill Modal */}
      {showSkillModal && (
        <div className="modal-overlay" onClick={() => setShowSkillModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Custom Skill</h2>
            <div className="form-group">
              <label>Skill Name</label>
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Enter skill name"
              />
            </div>
            <div className="form-group">
              <label>Skill Level (1-5)</label>
              <input
                type="range"
                min="1"
                max="5"
                value={skillLevel}
                onChange={(e) => setSkillLevel(parseInt(e.target.value))}
              />
              <span>{skillLevel}/5</span>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={addCustomSkill}>
                Add Skill
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSkillModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileCenter;