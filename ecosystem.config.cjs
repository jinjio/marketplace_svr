module.exports = {
  apps: [
    {
      name: 'marketplace_svr',
      script: 'app.js',
      instances: 1,
      autorestart: true,
      error_file: './logs/stderr.log',
      out_file: './logs/stdout.log',
      env_production: {
        watch: false,
        NODE_ENV: 'production',
        DEBUG: 'marketplace:*',
        DEBUG_FD: 1,
        PORT: 9099,
      },
    },
  ],

  deploy: {
    production: {
      host: ['3.38.19.36'],
      user: 'ubuntu',
      ref: 'origin/main',
      repo: 'git@github.com:jinjio/marketplace_svr.git',
      path: '/home/ubuntu/marketplace_svr',
      'post-deploy': 'yarn install && pm2 reload ecosystem.config.cjs --env production',
      key: '/Users/checkx/Documents/marketplace.pem',  
    }
  }
}
