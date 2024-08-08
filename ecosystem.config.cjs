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
      host: ['live.darichat.com'],
      user: 'ubuntu',
      ref: 'origin/main',
      repo: 'git@github.com:librorum/ankichmapion_svr.git',
      path: '/home/ubuntu/ankichampion_svr',
      'post-deploy': 'yarn install && pm2 reload ecosystem.config.cjs --env production'
    }
  }
}
