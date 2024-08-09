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
      'post-deploy': 'yarn install && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': 'echo "This is a pre-setup command"',
      'post-setup': 'echo "This is a post-setup command"',
      key: '/Users/checkx/Documents/marketplace.pem',  
    }
  }
}
