import React, { useState, useEffect, useRef } from 'react';
import './ContentStudio.css';

const ContentStudio = () => {
  const [activeTab, setActiveTab] = useState('creator');
  const [content, setContent] = useState([]);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [liveViewers, setLiveViewers] = useState(0);
  const [streamSettings, setStreamSettings] = useState({
    title: '',
    description: '',
    category: 'general',
    privacy: 'public'
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const [contentForm, setContentForm] = useState({
    title: '',
    description: '',
    type: 'post',
    category: 'general',
    tags: [],
    media: [],
    scheduledDate: '',
    privacy: 'public'
  });

  const [creatorTools] = useState([
    { id: 'text-editor', name: 'Rich Text Editor', icon: '📝', description: 'Advanced text formatting' },
    { id: 'image-editor', name: 'Image Editor', icon: '🎨', description: 'Edit and enhance images' },
    { id: 'video-editor', name: 'Video Editor', icon: '🎬', description: 'Basic video editing tools' },
    { id: 'ai-assistant', name: 'AI Writing Assistant', icon: '🤖', description: 'AI-powered content help' },
    { id: 'seo-optimizer', name: 'SEO Optimizer', icon: '🔍', description: 'Optimize for search' },
    { id: 'analytics', name: 'Content Analytics', icon: '📊', description: 'Track performance' },
    { id: 'scheduler', name: 'Content Scheduler', icon: '⏰', description: 'Schedule posts' },
    { id: 'templates', name: 'Content Templates', icon: '📋', description: 'Ready-to-use templates' }
  ]);

  const [contentCategories] = useState([
    'General', 'Technology', 'Education', 'Entertainment', 'News',
    'Sports', 'Music', 'Art', 'Gaming', 'Lifestyle', 'Business', 'Science'
  ]);

  const [aiSuggestions] = useState([
    "Try using trending hashtags related to your content",
    "Consider adding interactive elements like polls or Q&A",
    "Optimize your posting time for better engagement",
    "Add call-to-action to increase user interaction"
  ]);

  useEffect(() => {
    // Simulate content loading
    const sampleContent = [
      {
        id: 1,
        title: 'Welcome to Our Platform',
        type: 'post',
        status: 'published',
        views: 1250,
        likes: 89,
        comments: 23,
        createdAt: '2024-01-15',
        category: 'general'
      },
      {
        id: 2,
        title: 'AI Technology Trends 2024',
        type: 'article',
        status: 'draft',
        views: 0,
        likes: 0,
        comments: 0,
        createdAt: '2024-01-14',
        category: 'technology'
      },
      {
        id: 3,
        title: 'Live Coding Session',
        type: 'video',
        status: 'published',
        views: 3450,
        likes: 234,
        comments: 67,
        createdAt: '2024-01-13',
        category: 'education'
      }
    ];
    setContent(sampleContent);
  }, []);

  useEffect(() => {
    // Simulate live viewer count updates
    if (isLiveStreaming) {
      const interval = setInterval(() => {
        setLiveViewers(prev => prev + Math.floor(Math.random() * 5) - 2);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isLiveStreaming]);

  const handleInputChange = (field, value) => {
    setContentForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTagAdd = (tag) => {
    if (tag && !contentForm.tags.includes(tag)) {
      setContentForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setContentForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleMediaUpload = (e) => {
    const files = Array.from(e.target.files);
    const mediaFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
      preview: URL.createObjectURL(file)
    }));
    
    setContentForm(prev => ({
      ...prev,
      media: [...prev.media, ...mediaFiles]
    }));
  };

  const removeMedia = (mediaId) => {
    setContentForm(prev => ({
      ...prev,
      media: prev.media.filter(m => m.id !== mediaId)
    }));
  };

  const saveContent = async (status = 'draft') => {
    try {
      const newContent = {
        id: Date.now(),
        ...contentForm,
        status,
        views: 0,
        likes: 0,
        comments: 0,
        createdAt: new Date().toISOString().split('T')[0]
      };
      
      setContent(prev => [newContent, ...prev]);
      
      // Reset form
      setContentForm({
        title: '',
        description: '',
        type: 'post',
        category: 'general',
        tags: [],
        media: [],
        scheduledDate: '',
        privacy: 'public'
      });
      
      alert(`Content ${status === 'published' ? 'published' : 'saved as draft'} successfully!`);
    } catch (error) {
      alert('Error saving content');
    }
  };

  const startLiveStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      streamRef.current = stream;
      setIsLiveStreaming(true);
      setLiveViewers(Math.floor(Math.random() * 50) + 10);
    } catch (error) {
      alert('Error accessing camera/microphone');
    }
  };

  const stopLiveStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsLiveStreaming(false);
    setLiveViewers(0);
  };

  const renderCreatorTab = () => (
    <div className="creator-content">
      <div className="creator-header">
        <h3>Content Creator Studio</h3>
        <p>Create, edit, and manage your content</p>
      </div>

      <div className="content-creator-form">
        <div className="form-section">
          <h4>Create New Content</h4>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Content Type</label>
              <select
                value={contentForm.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
              >
                <option value="post">Social Post</option>
                <option value="article">Article</option>
                <option value="video">Video</option>
                <option value="podcast">Podcast</option>
                <option value="gallery">Gallery</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={contentForm.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
              >
                {contentCategories.map(cat => (
                  <option key={cat} value={cat.toLowerCase()}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Privacy</label>
              <select
                value={contentForm.privacy}
                onChange={(e) => handleInputChange('privacy', e.target.value)}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="friends">Friends Only</option>
                <option value="unlisted">Unlisted</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={contentForm.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter your content title..."
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={contentForm.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your content..."
              rows={6}
            />
          </div>

          <div className="form-group">
            <label>Tags</label>
            <div className="tags-input">
              <div className="tags-container">
                {contentForm.tags.map(tag => (
                  <span key={tag} className="tag">
                    {tag}
                    <button 
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      className="tag-remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add tags (press Enter)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTagAdd(e.target.value.trim());
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Media</label>
            <div className="media-upload">
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                onChange={handleMediaUpload}
                id="media-upload"
                style={{ display: 'none' }}
              />
              <label htmlFor="media-upload" className="upload-btn">
                📎 Add Media Files
              </label>
              
              {contentForm.media.length > 0 && (
                <div className="media-preview">
                  {contentForm.media.map(media => (
                    <div key={media.id} className="media-item">
                      {media.type === 'image' && (
                        <img src={media.preview} alt="Preview" />
                      )}
                      {media.type === 'video' && (
                        <video src={media.preview} controls />
                      )}
                      <button
                        className="media-remove"
                        onClick={() => removeMedia(media.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Schedule (Optional)</label>
            <input
              type="datetime-local"
              value={contentForm.scheduledDate}
              onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => saveContent('draft')}
            >
              Save as Draft
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => saveContent('published')}
            >
              Publish Now
            </button>
          </div>
        </div>

        <div className="ai-suggestions-panel">
          <h4>AI Content Assistant</h4>
          <div className="suggestions-list">
            {aiSuggestions.map((suggestion, index) => (
              <div key={index} className="suggestion-item">
                <span className="suggestion-icon">💡</span>
                <p>{suggestion}</p>
              </div>
            ))}
          </div>
          <button className="btn btn-outline btn-sm">Get More Suggestions</button>
        </div>
      </div>
    </div>
  );

  const renderToolsTab = () => (
    <div className="tools-content">
      <div className="tools-header">
        <h3>Creator Tools</h3>
        <p>Professional tools for content creation</p>
      </div>

      <div className="tools-grid">
        {creatorTools.map(tool => (
          <div key={tool.id} className="tool-card">
            <div className="tool-icon">{tool.icon}</div>
            <h4>{tool.name}</h4>
            <p>{tool.description}</p>
            <button className="btn btn-primary">Launch Tool</button>
          </div>
        ))}
      </div>

      <div className="featured-tools">
        <div className="featured-tool">
          <h4>🎨 Advanced Image Editor</h4>
          <div className="tool-interface">
            <div className="canvas-area">
              <canvas 
                ref={canvasRef}
                width={400}
                height={300}
                style={{background: '#f0f0f0', borderRadius: '8px'}}
              />
            </div>
            <div className="editor-controls">
              <button className="btn btn-sm">Crop</button>
              <button className="btn btn-sm">Filter</button>
              <button className="btn btn-sm">Text</button>
              <button className="btn btn-sm">Shapes</button>
            </div>
          </div>
        </div>

        <div className="featured-tool">
          <h4>📊 SEO Analyzer</h4>
          <div className="seo-analysis">
            <div className="seo-metric">
              <span>Readability</span>
              <div className="metric-bar">
                <div className="metric-fill" style={{width: '85%'}}></div>
              </div>
              <span>85%</span>
            </div>
            <div className="seo-metric">
              <span>Keyword Density</span>
              <div className="metric-bar">
                <div className="metric-fill" style={{width: '70%'}}></div>
              </div>
              <span>70%</span>
            </div>
            <div className="seo-metric">
              <span>Meta Tags</span>
              <div className="metric-bar">
                <div className="metric-fill" style={{width: '92%'}}></div>
              </div>
              <span>92%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLiveStreamTab = () => (
    <div className="livestream-content">
      <div className="livestream-header">
        <h3>Live Streaming Studio</h3>
        <div className="stream-status">
          <div className={`status-indicator ${isLiveStreaming ? 'live' : 'offline'}`}>
            {isLiveStreaming ? '🔴 LIVE' : '⚫ Offline'}
          </div>
          {isLiveStreaming && (
            <div className="viewer-count">
              👥 {liveViewers} viewers
            </div>
          )}
        </div>
      </div>

      <div className="stream-studio">
        <div className="stream-main">
          <div className="stream-preview">
            <video 
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="stream-video"
            />
            {!isLiveStreaming && (
              <div className="stream-placeholder">
                <div className="placeholder-content">
                  <span className="placeholder-icon">📹</span>
                  <p>Camera Preview</p>
                  <p>Click "Start Stream" to begin</p>
                </div>
              </div>
            )}
          </div>

          <div className="stream-controls">
            {!isLiveStreaming ? (
              <button className="btn btn-danger btn-lg" onClick={startLiveStream}>
                🎥 Start Stream
              </button>
            ) : (
              <button className="btn btn-secondary btn-lg" onClick={stopLiveStream}>
                ⏹️ End Stream
              </button>
            )}
            <button className="btn btn-outline">⚙️ Settings</button>
            <button className="btn btn-outline">🎬 Scenes</button>
            <button className="btn btn-outline">🎵 Audio</button>
          </div>
        </div>

        <div className="stream-sidebar">
          <div className="stream-settings">
            <h4>Stream Settings</h4>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={streamSettings.title}
                onChange={(e) => setStreamSettings(prev => ({...prev, title: e.target.value}))}
                placeholder="Enter stream title..."
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={streamSettings.description}
                onChange={(e) => setStreamSettings(prev => ({...prev, description: e.target.value}))}
                placeholder="Describe your stream..."
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={streamSettings.category}
                onChange={(e) => setStreamSettings(prev => ({...prev, category: e.target.value}))}
              >
                {contentCategories.map(cat => (
                  <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {isLiveStreaming && (
            <div className="live-chat">
              <h4>Live Chat</h4>
              <div className="chat-messages">
                <div className="chat-message">
                  <strong>User123:</strong> Great stream! 🔥
                </div>
                <div className="chat-message">
                  <strong>Viewer456:</strong> Can you show that again?
                </div>
                <div className="chat-message">
                  <strong>Fan789:</strong> Amazing content as always! ⭐
                </div>
              </div>
              <div className="chat-input">
                <input type="text" placeholder="Type a message..." />
                <button className="btn btn-sm">Send</button>
              </div>
            </div>
          )}

          <div className="stream-stats">
            <h4>Stream Analytics</h4>
            <div className="stat-item">
              <span>Total Viewers</span>
              <span className="stat-value">{isLiveStreaming ? liveViewers + Math.floor(Math.random() * 100) : 0}</span>
            </div>
            <div className="stat-item">
              <span>Peak Viewers</span>
              <span className="stat-value">{isLiveStreaming ? Math.max(liveViewers + 50, 100) : 0}</span>
            </div>
            <div className="stat-item">
              <span>Duration</span>
              <span className="stat-value">{isLiveStreaming ? '15:42' : '00:00'}</span>
            </div>
            <div className="stat-item">
              <span>Quality</span>
              <span className="stat-value">1080p 60fps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContentManagerTab = () => (
    <div className="content-manager">
      <div className="content-header">
        <h3>Content Manager</h3>
        <div className="content-filters">
          <select>
            <option value="all">All Content</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="scheduled">Scheduled</option>
          </select>
          <select>
            <option value="all">All Types</option>
            <option value="post">Posts</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
          </select>
        </div>
      </div>

      <div className="content-stats">
        <div className="stat-card">
          <h4>Total Content</h4>
          <span className="stat-number">{content.length}</span>
        </div>
        <div className="stat-card">
          <h4>Published</h4>
          <span className="stat-number">{content.filter(c => c.status === 'published').length}</span>
        </div>
        <div className="stat-card">
          <h4>Drafts</h4>
          <span className="stat-number">{content.filter(c => c.status === 'draft').length}</span>
        </div>
        <div className="stat-card">
          <h4>Total Views</h4>
          <span className="stat-number">{content.reduce((sum, c) => sum + c.views, 0)}</span>
        </div>
      </div>

      <div className="content-list">
        {content.map(item => (
          <div key={item.id} className="content-item">
            <div className="content-info">
              <h4>{item.title}</h4>
              <div className="content-meta">
                <span className={`status ${item.status}`}>{item.status}</span>
                <span className="type">{item.type}</span>
                <span className="date">{item.createdAt}</span>
              </div>
            </div>
            <div className="content-stats-inline">
              <span>👁️ {item.views}</span>
              <span>❤️ {item.likes}</span>
              <span>💬 {item.comments}</span>
            </div>
            <div className="content-actions">
              <button className="btn btn-sm btn-outline">Edit</button>
              <button className="btn btn-sm btn-outline">Analytics</button>
              <button className="btn btn-sm btn-outline">Share</button>
              <button className="btn btn-sm btn-danger">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const tabs = [
    { id: 'creator', name: 'Creator', icon: '✍️' },
    { id: 'tools', name: 'Tools', icon: '🛠️' },
    { id: 'livestream', name: 'Live Stream', icon: '📹' },
    { id: 'manager', name: 'Manager', icon: '📊' }
  ];

  return (
    <div className="content-studio">
      <div className="studio-header">
        <h1>Content Studio</h1>
        <nav className="studio-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-text">{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="studio-content">
        {activeTab === 'creator' && renderCreatorTab()}
        {activeTab === 'tools' && renderToolsTab()}
        {activeTab === 'livestream' && renderLiveStreamTab()}
        {activeTab === 'manager' && renderContentManagerTab()}
      </div>
    </div>
  );
};

export default ContentStudio;