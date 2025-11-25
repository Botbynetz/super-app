/**
 * PM2 Ecosystem Configuration for Staging Deployment
 * Enables clustering, auto-restart, and monitoring
 */

module.exports = {
  apps: [{
    name: 'superapp-backend',
    script: './server.js',
    
    // Cluster mode for load balancing
    instances: process.env.PM2_INSTANCES || 2,
    exec_mode: 'cluster',
    
    // Auto-restart configuration
    watch: false,
    max_memory_restart: '500M',
    
    // Environment variables
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 5000,
    },
    
    // Logging
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/combined.log',
    merge_logs: true,
    
    // Advanced features
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Kill timeout for graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,
    
    // PM2 metrics monitoring
    instance_var: 'INSTANCE_ID',
    
    // Graceful start/shutdown
    wait_ready: true,
    shutdown_with_message: true,
  }],
  
  // PM2 deploy configuration (optional)
  deploy: {
    staging: {
      user: 'node',
      host: 'staging.superapp.render.com',
      ref: 'origin/staging',
      repo: 'https://github.com/Botbynetz/super-app.git',
      path: '/app',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
