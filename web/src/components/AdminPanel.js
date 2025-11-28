import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [contents, setContents] = useState([]);
  const [reports, setReports] = useState([]);
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalContent: 0,
    pendingReports: 0,
    systemHealth: 100,
    storageUsed: 65
  });

  const [selectedUsers, setSelectedUsers] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  useEffect(() => {
    // Simulate data loading
    const sampleUsers = [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        status: 'active',
        lastLogin: '2024-01-15',
        joinDate: '2024-01-01',
        posts: 25,
        warnings: 0
      },
      {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'moderator',
        status: 'active',
        lastLogin: '2024-01-14',
        joinDate: '2023-12-15',
        posts: 89,
        warnings: 1
      },
      {
        id: 3,
        name: 'Bob Johnson',
        email: 'bob@example.com',
        role: 'user',
        status: 'suspended',
        lastLogin: '2024-01-10',
        joinDate: '2023-11-20',
        posts: 156,
        warnings: 3
      }
    ];

    const sampleContent = [
      {
        id: 1,
        title: 'How to Get Started',
        author: 'John Doe',
        type: 'post',
        status: 'published',
        reports: 0,
        views: 1250,
        createdAt: '2024-01-15'
      },
      {
        id: 2,
        title: 'Controversial Opinion',
        author: 'Bob Johnson',
        type: 'post',
        status: 'flagged',
        reports: 5,
        views: 890,
        createdAt: '2024-01-14'
      },
      {
        id: 3,
        title: 'Tutorial Video',
        author: 'Jane Smith',
        type: 'video',
        status: 'published',
        reports: 0,
        views: 3420,
        createdAt: '2024-01-13'
      }
    ];

    const sampleReports = [
      {
        id: 1,
        type: 'content',
        reason: 'Inappropriate content',
        reportedBy: 'User123',
        target: 'Post: Controversial Opinion',
        status: 'pending',
        createdAt: '2024-01-15',
        severity: 'medium'
      },
      {
        id: 2,
        type: 'user',
        reason: 'Spam behavior',
        reportedBy: 'User456',
        target: 'User: Bob Johnson',
        status: 'reviewed',
        createdAt: '2024-01-14',
        severity: 'high'
      }
    ];

    setUsers(sampleUsers);
    setContents(sampleContent);
    setReports(sampleReports);
    
    setSystemStats({
      totalUsers: sampleUsers.length,
      activeUsers: sampleUsers.filter(u => u.status === 'active').length,
      totalContent: sampleContent.length,
      pendingReports: sampleReports.filter(r => r.status === 'pending').length,
      systemHealth: 98,
      storageUsed: 67
    });
  }, []);

  const handleUserSelect = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedUsers.length === 0) return;
    
    switch(bulkAction) {
      case 'suspend':
        setUsers(prev => prev.map(user => 
          selectedUsers.includes(user.id) 
            ? {...user, status: 'suspended'}
            : user
        ));
        break;
      case 'activate':
        setUsers(prev => prev.map(user => 
          selectedUsers.includes(user.id) 
            ? {...user, status: 'active'}
            : user
        ));
        break;
      case 'delete':
        setUsers(prev => prev.filter(user => !selectedUsers.includes(user.id)));
        break;
      default:
        console.log('Unknown bulk action:', bulkAction);
        break;
    }
    
    setSelectedUsers([]);
    setBulkAction('');
    alert(`Bulk action "${bulkAction}" applied to ${selectedUsers.length} users`);
  };

  const handleContentAction = (contentId, action) => {
    setContents(prev => prev.map(content => 
      content.id === contentId 
        ? {...content, status: action}
        : content
    ));
  };

  const handleReportAction = (reportId, action) => {
    setReports(prev => prev.map(report => 
      report.id === reportId 
        ? {...report, status: action}
        : report
    ));
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const renderDashboardTab = () => (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <h3>Admin Dashboard</h3>
        <p>System overview and key metrics</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h4>Total Users</h4>
            <span className="stat-number">{systemStats.totalUsers}</span>
            <span className="stat-change positive">+12 this week</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-info">
            <h4>Active Users</h4>
            <span className="stat-number">{systemStats.activeUsers}</span>
            <span className="stat-change positive">+8 today</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-info">
            <h4>Total Content</h4>
            <span className="stat-number">{systemStats.totalContent}</span>
            <span className="stat-change positive">+23 today</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h4>Pending Reports</h4>
            <span className="stat-number">{systemStats.pendingReports}</span>
            <span className="stat-change negative">Needs attention</span>
          </div>
        </div>
      </div>

      <div className="dashboard-charts">
        <div className="chart-container">
          <h4>System Health</h4>
          <div className="health-indicator">
            <div className="health-circle">
              <svg viewBox="0 0 36 36" className="circular-chart green">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${systemStats.systemHealth}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="percentage">{systemStats.systemHealth}%</div>
            </div>
            <div className="health-details">
              <div className="detail-item">
                <span>CPU Usage: 45%</span>
                <div className="detail-bar">
                  <div className="detail-fill" style={{width: '45%'}}></div>
                </div>
              </div>
              <div className="detail-item">
                <span>Memory: 62%</span>
                <div className="detail-bar">
                  <div className="detail-fill" style={{width: '62%'}}></div>
                </div>
              </div>
              <div className="detail-item">
                <span>Storage: {systemStats.storageUsed}%</span>
                <div className="detail-bar">
                  <div className="detail-fill" style={{width: `${systemStats.storageUsed}%`}}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="chart-container">
          <h4>Recent Activity</h4>
          <div className="activity-feed">
            <div className="activity-item">
              <span className="activity-time">10 min ago</span>
              <span className="activity-text">New user registration: jane@example.com</span>
            </div>
            <div className="activity-item">
              <span className="activity-time">25 min ago</span>
              <span className="activity-text">Content flagged: "Controversial Opinion"</span>
            </div>
            <div className="activity-item">
              <span className="activity-time">1 hour ago</span>
              <span className="activity-text">User suspended: bob@example.com</span>
            </div>
            <div className="activity-item">
              <span className="activity-time">2 hours ago</span>
              <span className="activity-text">Backup completed successfully</span>
            </div>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h4>Quick Actions</h4>
        <div className="action-buttons">
          <button className="btn btn-primary">Create Announcement</button>
          <button className="btn btn-secondary">Export Data</button>
          <button className="btn btn-outline">System Backup</button>
          <button className="btn btn-warning">Maintenance Mode</button>
        </div>
      </div>
    </div>
  );

  const renderUsersTab = () => (
    <div className="users-content">
      <div className="users-header">
        <h3>User Management</h3>
        <div className="users-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <button className="btn btn-primary">Add User</button>
        </div>
      </div>

      {selectedUsers.length > 0 && (
        <div className="bulk-actions">
          <span>{selectedUsers.length} users selected</span>
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
          >
            <option value="">Choose action...</option>
            <option value="activate">Activate</option>
            <option value="suspend">Suspend</option>
            <option value="delete">Delete</option>
          </select>
          <button className="btn btn-warning" onClick={handleBulkAction}>
            Apply Action
          </button>
        </div>
      )}

      <div className="users-table">
        <div className="table-header">
          <div className="header-cell">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUsers(filteredUsers.map(u => u.id));
                } else {
                  setSelectedUsers([]);
                }
              }}
            />
          </div>
          <div className="header-cell">User</div>
          <div className="header-cell">Role</div>
          <div className="header-cell">Status</div>
          <div className="header-cell">Last Login</div>
          <div className="header-cell">Posts</div>
          <div className="header-cell">Actions</div>
        </div>
        
        {filteredUsers.map(user => (
          <div key={user.id} className="table-row">
            <div className="table-cell">
              <input
                type="checkbox"
                checked={selectedUsers.includes(user.id)}
                onChange={() => handleUserSelect(user.id)}
              />
            </div>
            <div className="table-cell">
              <div className="user-info">
                <div className="user-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="user-name">{user.name}</div>
                  <div className="user-email">{user.email}</div>
                </div>
              </div>
            </div>
            <div className="table-cell">
              <span className={`role-badge ${user.role}`}>{user.role}</span>
            </div>
            <div className="table-cell">
              <span className={`status-badge ${user.status}`}>{user.status}</span>
            </div>
            <div className="table-cell">{user.lastLogin}</div>
            <div className="table-cell">{user.posts}</div>
            <div className="table-cell">
              <div className="action-buttons">
                <button className="btn btn-sm btn-outline">Edit</button>
                <button className="btn btn-sm btn-warning">Suspend</button>
                <button className="btn btn-sm btn-danger">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContentTab = () => (
    <div className="content-moderation">
      <div className="moderation-header">
        <h3>Content Moderation</h3>
        <div className="moderation-filters">
          <select>
            <option value="all">All Content</option>
            <option value="flagged">Flagged</option>
            <option value="reported">Reported</option>
            <option value="pending">Pending Review</option>
          </select>
          <select>
            <option value="all">All Types</option>
            <option value="post">Posts</option>
            <option value="video">Videos</option>
            <option value="image">Images</option>
          </select>
        </div>
      </div>

      <div className="content-list">
        {contents.map(content => (
          <div key={content.id} className="content-item">
            <div className="content-info">
              <h4>{content.title}</h4>
              <div className="content-meta">
                <span>By: {content.author}</span>
                <span>Type: {content.type}</span>
                <span>Views: {content.views}</span>
                <span>Reports: {content.reports}</span>
              </div>
            </div>
            <div className="content-status">
              <span className={`status-indicator ${content.status}`}>
                {content.status}
              </span>
            </div>
            <div className="content-actions">
              <button 
                className="btn btn-sm btn-success"
                onClick={() => handleContentAction(content.id, 'approved')}
              >
                Approve
              </button>
              <button 
                className="btn btn-sm btn-warning"
                onClick={() => handleContentAction(content.id, 'flagged')}
              >
                Flag
              </button>
              <button 
                className="btn btn-sm btn-danger"
                onClick={() => handleContentAction(content.id, 'removed')}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderReportsTab = () => (
    <div className="reports-content">
      <div className="reports-header">
        <h3>Reports & Issues</h3>
        <div className="reports-filters">
          <select>
            <option value="all">All Reports</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
          <select>
            <option value="all">All Types</option>
            <option value="content">Content</option>
            <option value="user">User</option>
            <option value="technical">Technical</option>
          </select>
        </div>
      </div>

      <div className="reports-list">
        {reports.map(report => (
          <div key={report.id} className="report-item">
            <div className="report-info">
              <div className="report-header">
                <h4>{report.reason}</h4>
                <span className={`severity-badge ${report.severity}`}>
                  {report.severity} priority
                </span>
              </div>
              <div className="report-details">
                <p><strong>Target:</strong> {report.target}</p>
                <p><strong>Reported by:</strong> {report.reportedBy}</p>
                <p><strong>Date:</strong> {report.createdAt}</p>
              </div>
            </div>
            <div className="report-status">
              <span className={`status-badge ${report.status}`}>
                {report.status}
              </span>
            </div>
            <div className="report-actions">
              <button 
                className="btn btn-sm btn-primary"
                onClick={() => handleReportAction(report.id, 'investigating')}
              >
                Investigate
              </button>
              <button 
                className="btn btn-sm btn-success"
                onClick={() => handleReportAction(report.id, 'resolved')}
              >
                Resolve
              </button>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => handleReportAction(report.id, 'dismissed')}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="settings-content">
      <div className="settings-header">
        <h3>System Settings</h3>
        <p>Configure system behavior and preferences</p>
      </div>

      <div className="settings-sections">
        <div className="settings-section">
          <h4>General Settings</h4>
          <div className="setting-item">
            <label>Site Name</label>
            <input type="text" defaultValue="Super App" />
          </div>
          <div className="setting-item">
            <label>Site Description</label>
            <textarea defaultValue="A comprehensive platform for creators and users"></textarea>
          </div>
          <div className="setting-item">
            <label>Maintenance Mode</label>
            <label className="toggle-switch">
              <input type="checkbox" />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h4>User Settings</h4>
          <div className="setting-item">
            <label>Allow Registration</label>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <label>Email Verification Required</label>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <label>Maximum Upload Size (MB)</label>
            <input type="number" defaultValue="50" />
          </div>
        </div>

        <div className="settings-section">
          <h4>Content Settings</h4>
          <div className="setting-item">
            <label>Auto-moderate Content</label>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <label>Require Approval for Posts</label>
            <label className="toggle-switch">
              <input type="checkbox" />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h4>Security Settings</h4>
          <div className="setting-item">
            <label>Two-Factor Authentication</label>
            <label className="toggle-switch">
              <input type="checkbox" defaultChecked />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <label>Session Timeout (minutes)</label>
            <input type="number" defaultValue="60" />
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn btn-primary">Save Settings</button>
          <button className="btn btn-secondary">Reset to Default</button>
          <button className="btn btn-danger">Clear Cache</button>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'users', name: 'Users', icon: '👥' },
    { id: 'content', name: 'Content', icon: '📝' },
    { id: 'reports', name: 'Reports', icon: '⚠️' },
    { id: 'settings', name: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="admin-panel">
      <div className="admin-sidebar">
        <div className="admin-header">
          <h2>Admin Panel</h2>
          <p>System Administration</p>
        </div>
        <nav className="admin-nav">
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

      <div className="admin-main">
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'users' && renderUsersTab()}
        {activeTab === 'content' && renderContentTab()}
        {activeTab === 'reports' && renderReportsTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>
    </div>
  );
};

export default AdminPanel;