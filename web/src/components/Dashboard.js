import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  getProfile, 
  getAllContent, 
  getTrendingContent, 
  getRecommendedContent, 
  getAllEvents, 
  searchContent, 
  likeContent, 
  incrementContentView, 
  unlockContent, 
  checkUnlock, 
  getWallet,
  getDashboardAnalytics, 
  getAnalyticsContent, 
  getAnalyticsRevenue,
  getAnalyticsUserGrowth,
  getAnalyticsEngagement
} from '../api';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import AIRecommendations from './AIRecommendations';
import './Dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function Dashboard({ token, user, setToken }) {
  const navigate = useNavigate();
  
  // Main Dashboard State
  const [activeSection, setActiveSection] = useState('overview'); // overview, content, analytics, events
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  
  // Content State
  const [contents, setContents] = useState([]);
  const [trendingContents, setTrendingContents] = useState([]);
  const [recommendedContents, setRecommendedContents] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    category: 'All',
    type: 'all',
    sort: 'newest',
    priceFilter: 'all'
  });
  const [unlockedContents, setUnlockedContents] = useState(new Set());
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  
  // Analytics State
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [contentStats, setContentStats] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [engagementData, setEngagementData] = useState(null);
  const [timeRange, setTimeRange] = useState('7days');
  
  // Modal State - Reserved for future use
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    loadInitialData();
  }, [token, navigate, loadInitialData]);

  useEffect(() => {
    if (activeTab === 'all') {
      loadAllContent();
    }
  }, [filters, activeTab, loadAllContent]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadProfile(),
      loadWallet(),
      loadAllContent(),
      loadTrendingContent(), 
      loadRecommendedContent(),
      loadAllEvents(),
      loadAnalytics()
    ]);
    setLoading(false);
  }, [token, filters]);

  // Profile & Wallet Functions
  const loadProfile = async () => {
    try {
      const response = await getProfile(token);
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadWallet = async () => {
    try {
      const response = await getWallet(token);
      setWallet(response.data);
    } catch (error) {
      console.error('Error loading wallet:', error);
    }
  };

  // Content Functions
  const loadAllContent = useCallback(async () => {
    try {
      const response = await getAllContent(token, filters);
      setContents(response.data || []);
      
      // Check unlock status
      if (response.data && Array.isArray(response.data)) {
        const unlocked = new Set();
        for (const content of response.data) {
          if (content.isPremium) {
            try {
              const unlockStatus = await checkUnlock(content._id, token);
              if (unlockStatus.data.unlocked) {
                unlocked.add(content._id);
              }
            } catch (error) {
              console.log(`Could not check unlock status for ${content._id}`);
            }
          } else {
            unlocked.add(content._id);
          }
        }
        setUnlockedContents(unlocked);
      }
    } catch (error) {
      console.error('Error loading content:', error);
      setContents([]);
    }
  }, [token, filters]);

  const loadTrendingContent = async () => {
    try {
      const response = await getTrendingContent(token);
      setTrendingContents(response.data || []);
    } catch (error) {
      console.error('Error loading trending content:', error);
      setTrendingContents([]);
    }
  };

  const loadRecommendedContent = async () => {
    try {
      const response = await getRecommendedContent(token);
      setRecommendedContents(response.data || []);
    } catch (error) {
      console.error('Error loading recommended content:', error);
      setRecommendedContents([]);
    }
  };

  const loadAllEvents = async () => {
    try {
      const response = await getAllEvents(token);
      setEvents(response.data || []);
    } catch (error) {
      console.error('Error loading events:', error);
      setEvents([]);
    }
  };

  // Analytics Functions
  const loadAnalytics = useCallback(async () => {
    try {
      const [dashboardRes, contentRes, revenueRes, growthRes, engagementRes] = await Promise.all([
        getDashboardAnalytics(token, timeRange),
        getAnalyticsContent(token, timeRange),
        getAnalyticsRevenue(token, timeRange),
        getAnalyticsUserGrowth(token, timeRange),
        getAnalyticsEngagement(token, timeRange)
      ]);

      setDashboard(dashboardRes.data);
      setContentStats(contentRes.data);
      setRevenueData(revenueRes.data);
      setGrowthData(growthRes.data);
      setEngagementData(engagementRes.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }, [token, timeRange]);

  // Search & Filter Functions
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadAllContent();
      return;
    }

    try {
      const response = await searchContent(searchQuery, token);
      setContents(response.data || []);
    } catch (error) {
      console.error('Error searching content:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Content Actions
  const handleContentView = async (content) => {
    try {
      if (content.isPremium && !unlockedContents.has(content._id)) {
        setSelectedContent(content);
        setShowUnlockModal(true);
        return;
      }
      
      await incrementContentView(content._id, token);
      window.open(content.mediaUrl, '_blank');
    } catch (error) {
      console.error('Error viewing content:', error);
    }
  };

  const handleLike = async (contentId) => {
    try {
      await likeContent(contentId, token);
      loadAllContent(); // Refresh to show updated likes
    } catch (error) {
      console.error('Error liking content:', error);
    }
  };

  const handleUnlock = async () => {
    try {
      await unlockContent(selectedContent._id, token);
      setUnlockedContents(prev => new Set([...prev, selectedContent._id]));
      setShowUnlockModal(false);
      loadWallet(); // Refresh wallet
    } catch (error) {
      console.error('Error unlocking content:', error);
      alert('Failed to unlock content. Please check your wallet balance.');
    }
  };

  const renderOverview = () => (
    <div className="dashboard-overview">
      <div className="overview-header">
        <h2>Welcome back, {profile?.displayName || 'User'}!</h2>
        <p>Here's what's happening with your account today.</p>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>Wallet Balance</h3>
            <p className="stat-value">{wallet?.balance || 0} coins</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>Total Content</h3>
            <p className="stat-value">{contents.length}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <h3>Events</h3>
            <p className="stat-value">{events.length}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <h3>Growth</h3>
            <p className="stat-value">+{dashboard?.userGrowth || 0}%</p>
          </div>
        </div>
      </div>

      {/* Recent Activity & AI Recommendations */}
      <div className="overview-content">
        <div className="recent-activity">
          <h3>Trending Content</h3>
          <div className="content-preview-grid">
            {trendingContents.slice(0, 4).map((content) => (
              <div key={content._id} className="content-preview-card">
                <img src={content.thumbnailUrl || '/default-thumb.jpg'} alt={content.title} />
                <div className="content-preview-info">
                  <h4>{content.title}</h4>
                  <p>{content.views} views</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="ai-recommendations-section">
          <h3>AI Recommendations</h3>
          <AIRecommendations token={token} />
        </div>
      </div>
    </div>
  );

  const renderContent = () => (
    <div className="dashboard-content">
      <div className="content-header">
        <h2>Content Management</h2>
        <div className="content-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setShowUpload(true)}
          >
            📤 Upload Content
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowCreateEvent(true)}
          >
            📅 Create Event
          </button>
        </div>
      </div>

      {/* Content Filters & Search */}
      <div className="content-controls">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-search">🔍</button>
        </form>

        <div className="content-filters">
          <select 
            value={filters.category} 
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Technology">Technology</option>
            <option value="Education">Education</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Business">Business</option>
          </select>

          <select 
            value={filters.type} 
            onChange={(e) => handleFilterChange('type', e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>

          <select 
            value={filters.sort} 
            onChange={(e) => handleFilterChange('sort', e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="popular">Most Popular</option>
            <option value="trending">Trending</option>
          </select>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="content-tabs">
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Content ({contents.length})
        </button>
        <button 
          className={`tab ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => setActiveTab('trending')}
        >
          Trending ({trendingContents.length})
        </button>
        <button 
          className={`tab ${activeTab === 'recommended' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommended')}
        >
          Recommended ({recommendedContents.length})
        </button>
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {(activeTab === 'all' ? contents : 
          activeTab === 'trending' ? trendingContents : recommendedContents)
          .map((content) => (
            <div key={content._id} className="content-card">
              <div className="content-thumbnail">
                <img 
                  src={content.thumbnailUrl || '/default-thumb.jpg'} 
                  alt={content.title}
                  onError={(e) => {
                    e.target.src = '/default-thumb.jpg';
                  }}
                />
                {content.isPremium && (
                  <div className="premium-badge">
                    {unlockedContents.has(content._id) ? '🔓' : '🔒'} Premium
                  </div>
                )}
              </div>
              
              <div className="content-info">
                <h3>{content.title}</h3>
                <p>{content.description}</p>
                <div className="content-meta">
                  <span>👤 {content.creator?.displayName || 'Unknown'}</span>
                  <span>👁 {content.views} views</span>
                  <span>❤️ {content.likes} likes</span>
                  <span>📅 {new Date(content.createdAt).toLocaleDateString()}</span>
                </div>
                
                <div className="content-actions">
                  <button 
                    onClick={() => handleContentView(content)}
                    className="btn btn-primary"
                  >
                    {content.isPremium && !unlockedContents.has(content._id) ? 
                      `Unlock (${content.price} coins)` : 'View'
                    }
                  </button>
                  <button 
                    onClick={() => handleLike(content._id)}
                    className="btn btn-secondary"
                  >
                    ❤️ Like
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="dashboard-analytics">
      <div className="analytics-header">
        <h2>Analytics Dashboard</h2>
        <div className="time-range-selector">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="1year">Last Year</option>
          </select>
        </div>
      </div>

      {dashboard && (
        <>
          {/* Analytics Overview */}
          <div className="analytics-overview">
            <div className="analytics-card">
              <h3>Total Views</h3>
              <p className="analytics-value">{dashboard.totalViews?.toLocaleString() || 0}</p>
              <span className="analytics-trend">+{dashboard.viewsGrowth || 0}%</span>
            </div>
            
            <div className="analytics-card">
              <h3>Total Revenue</h3>
              <p className="analytics-value">${dashboard.totalRevenue?.toLocaleString() || 0}</p>
              <span className="analytics-trend">+{dashboard.revenueGrowth || 0}%</span>
            </div>
            
            <div className="analytics-card">
              <h3>Engagement Rate</h3>
              <p className="analytics-value">{dashboard.engagementRate || 0}%</p>
              <span className="analytics-trend">+{dashboard.engagementGrowth || 0}%</span>
            </div>
            
            <div className="analytics-card">
              <h3>Active Users</h3>
              <p className="analytics-value">{dashboard.activeUsers?.toLocaleString() || 0}</p>
              <span className="analytics-trend">+{dashboard.userGrowth || 0}%</span>
            </div>
          </div>

          {/* Charts */}
          {revenueData && (
            <div className="analytics-charts">
              <div className="chart-container">
                <h3>Revenue Trend</h3>
                <Line data={revenueData} options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Revenue Over Time' }
                  }
                }} />
              </div>
              
              {growthData && (
                <div className="chart-container">
                  <h3>User Growth</h3>
                  <Bar data={growthData} options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'User Growth' }
                    }
                  }} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderEvents = () => (
    <div className="dashboard-events">
      <div className="events-header">
        <h2>Events & Activities</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateEvent(true)}
        >
          ➕ Create Event
        </button>
      </div>

      <div className="events-grid">
        {events.map((event) => (
          <div key={event._id} className="event-card">
            <div className="event-date">
              <span className="day">{new Date(event.date).getDate()}</span>
              <span className="month">{new Date(event.date).toLocaleDateString('en', { month: 'short' })}</span>
            </div>
            
            <div className="event-info">
              <h3>{event.title}</h3>
              <p>{event.description}</p>
              <div className="event-meta">
                <span>📍 {event.location}</span>
                <span>🎫 {event.attendees?.length || 0} attending</span>
                <span>💰 {event.price === 0 ? 'Free' : `$${event.price}`}</span>
              </div>
            </div>
            
            <div className="event-actions">
              <button className="btn btn-primary">View Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Navigation Sidebar */}
      <nav className="dashboard-nav">
        <div className="nav-header">
          <h1>Super App</h1>
          <div className="user-info">
            <img src={profile?.avatar || '/default-avatar.jpg'} alt="Profile" />
            <span>{profile?.displayName || 'User'}</span>
          </div>
        </div>
        
        <ul className="nav-menu">
          <li 
            className={activeSection === 'overview' ? 'active' : ''}
            onClick={() => setActiveSection('overview')}
          >
            <span className="nav-icon">🏠</span>
            Overview
          </li>
          <li 
            className={activeSection === 'content' ? 'active' : ''}
            onClick={() => setActiveSection('content')}
          >
            <span className="nav-icon">📱</span>
            Content
          </li>
          <li 
            className={activeSection === 'analytics' ? 'active' : ''}
            onClick={() => setActiveSection('analytics')}
          >
            <span className="nav-icon">📊</span>
            Analytics
          </li>
          <li 
            className={activeSection === 'events' ? 'active' : ''}
            onClick={() => setActiveSection('events')}
          >
            <span className="nav-icon">📅</span>
            Events
          </li>
        </ul>

        <div className="nav-footer">
          <Link to="/profile-center" className="nav-link">⚙️ Profile</Link>
          <Link to="/chat-hub" className="nav-link">💬 AI Chat</Link>
          <button onClick={() => { setToken(null); navigate('/login'); }} className="nav-link logout">
            🚪 Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="dashboard-main">
        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'content' && renderContent()}
        {activeSection === 'analytics' && renderAnalytics()}
        {activeSection === 'events' && renderEvents()}
      </main>

      {/* Modals */}
      {showUnlockModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Unlock Premium Content</h2>
            <p>This content costs {selectedContent?.price} coins to unlock.</p>
            <p>Your balance: {wallet?.balance} coins</p>
            <div className="modal-actions">
              <button onClick={() => setShowUnlockModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button 
                onClick={handleUnlock} 
                className="btn btn-primary"
                disabled={wallet?.balance < selectedContent?.price}
              >
                Unlock Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
