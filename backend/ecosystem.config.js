module.exports = {
  apps: [
    {
      name: 'pip-backend',
      script: 'dist/app.js',        // compiled JS — run `npm run build` first
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3030,
      },
    },
  ],
};
