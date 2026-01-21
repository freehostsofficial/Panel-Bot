# Deployment Guide

This guide covers deploying the Discord bot to production environments.

## Prerequisites

Before deploying, ensure you have:

- ✅ Completed development and testing
- ✅ PostgreSQL database set up (if using)
- ✅ Server/VPS with Node.js >=16.11.0
- ✅ Domain name (optional, for monitoring/webhooks)
- ✅ SSL/TLS certificates (for database connections)

## Deployment Options

### Option 1: VPS/Dedicated Server (Recommended)

**Providers**: DigitalOcean, Linode, AWS EC2, Google Cloud Compute Engine, etc.

**Advantages:**
- Full control over environment
- Better performance  
- Scalable

### Option 2: PaaS (Platform as a Service)

**Providers**: Heroku, Railway, Render, etc.

**Advantages:**
- Easier setup
- Automatic scaling
- Built-in monitoring


## Step-by-Step Deployment (VPS)

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be >= 16.11.0
npm --version   # Should be >= 7.0.0

# Install PostgreSQL (if not using external database)
sudo apt install -y postgresql postgresql-contrib

# Install PM2 (Process Manager)
sudo npm install -g pm2
```

### 2. PostgreSQL Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE your_bot_database;
CREATE USER your_bot_user WITH ENCRYPTED PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE your_bot_database TO your_bot_user;
\q

# Configure PostgreSQL for remote connections (if needed)
sudo nano /etc/postgresql/*/main/postgresql.conf
# Uncomment and set: listen_addresses = '*'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host all all 0.0.0.0/0 md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 3. Clone and Configure Bot

```bash
# Create application directory
sudo mkdir -p /opt/discord-bot
sudo chown $USER:$USER /opt/discord-bot
cd /opt/discord-bot

# Clone repository
git clone https://github.com/YourUsername/Discord-Bot-Template.git .

# Install dependencies (production only)
npm install --production

# Create .env file
nano .env
```

**Production `.env` example:**

```env
NODE_ENV=production

# Bot Configuration
SETTINGS_BOT_TOKEN=your_production_bot_token
SETTINGS_BOT_CLIENTID=your_client_id
SETTINGS_BOT_CLIENTSECRET=your_client_secret

# Developer IDs
SETTINGS_DEVELOPER_IDS=your_discord_id
SETTINGS_DEVELOPER_OWNER_IDS=your_discord_id

# Database Configuration
SERVER_POSTGRES_HOST=localhost
SERVER_POSTGRES_PORT=5432
SERVER_POSTGRES_USER=your_bot_user
SERVER_POSTGRES_PASSWORD=strong_password_here
SERVER_POSTGRES_DATABASE=your_bot_database
SERVER_POSTGRES_SSL=true

# Logging
LOGS_ERRORLOGS_WEBHOOK=https://discord.com/api/webhooks/...
LOGS_COMMANDLOGS_WEBHOOK=https://discord.com/api/webhooks/...
```

**Secure the `.env` file:**

```bash
chmod 600 .env
```

### 4. Test the Bot

```bash
# Test run
npm start

# Check console output for:
# ✅ Configuration validated successfully
# ✅ PostgreSQL connected
# �� Logged in as YourBot#1234
```

Press `Ctrl+C` to stop after verifying.

### 5. Set Up PM2

Create PM2 ecosystem file:

```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'discord-bot',
    script: './index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10
  }]
};
```

Start the bot with PM2:

```bash
# Create logs directory
mkdir -p logs

# Start bot
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Follow the instructions PM2 provides
```

### 6. PM2 Management Commands

```bash
# View bot status
pm2 status

# View logs
pm2 logs discord-bot

# View last 100 lines
pm2 logs discord-bot --lines 100

# Restart bot
pm2 restart discord-bot

# Stop bot
pm2 stop discord-bot

# Monitor
pm2 monit
```

## Environment-Specific Configuration

### Development

```env
NODE_ENV=development
DB_DEBUG=true
SERVER_POSTGRES_SSL=false
```

### Staging

```env
NODE_ENV =staging
DB_DEBUG=false
SERVER_POSTGRES_SSL=true
```

### Production

```env
NODE_ENV=production
DB_DEBUG=false
SERVER_POSTGRES_SSL=true
```

## Security Hardening

### Firewall Configuration

```bash
# Allow SSH (if not already configured)
sudo ufw allow 22/tcp

# Allow PostgreSQL only from localhost (if database is local)
# No need to open port 5432 externally

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### SSL/TLS for PostgreSQL

Generate self-signed certificate (or use Let's Encrypt):

```bash
# Self-signed certificate
sudo openssl req -new -x509 -days 365 -nodes -text \
  -out /etc/postgresql/*/main/server.crt \
  -keyout /etc/postgresql/*/main/server.key \
  -subj "/CN=localhost"

sudo chmod 600 /etc/postgresql/*/main/server.key
sudo chown postgres:postgres /etc/postgresql/*/main/server.*

# Update postgresql.conf
ssl = on
ssl_cert_file = '/etc/postgresql/*/main/server.crt'
ssl_key_file = '/etc/postgresql/*/main/server.key'
```

### Regular Security Updates

```bash
# Set up automatic security updates (Ubuntu/Debian)
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Monitoring & Logging

### PM2 Plus (Optional)

```bash
# Link to PM2 Plus for advanced monitoring
pm2 link <secret> <public>
```

### Log Rotation

```bash
# Install PM2 log rotate module
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### External Monitoring

Consider using:
- **UptimeRobot**: Monitor bot uptime
- **Sentry**: Error tracking
- **Discord Webhooks**: Status notifications

## Backup and Recovery

### Database Backups

Create backup script (`backup.sh`):

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/discord-bot"
mkdir -p $BACKUP_DIR

pg_dump -U your_bot_user -h localhost your_bot_database | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 7 backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

Make executable and add to cron:

```bash
chmod +x backup.sh

# Run daily at 2 AM
crontab -e
# Add: 0 2 * * * /opt/discord-bot/backup.sh
```

### Restore from Backup

```bash
gunzip < backup_YYYYMMDD_HHMMSS.sql.gz | psql -U your_bot_user -h localhost your_bot_database
```

## Scaling Considerations

### Vertical Scaling (Single Server)

- Increase server resources (CPU, RAM)
- Optimize database queries
- Use connection pooling (already implemented)

### Horizontal Scaling (Multiple Servers)

Discord bots with sharding:

```javascript
// Update index.js for sharding
const { ShardingManager } = require('discord.js');
const manager = new ShardingManager('./index.js', { 
  token: process.env.SETTINGS_BOT_TOKEN,
  totalShards: 'auto'
});

manager.on('shardCreate', shard => {
  console.log(`Launched shard ${shard.id}`);
});

manager.spawn();
```

## Troubleshooting Production Issues

### Bot Not Starting

```bash
# Check PM2 logs
pm2 logs discord-bot --lines 50

# Check configuration
cat .env | grep -v PASSWORD

# Test database connection
pg_isready -h localhost -U your_bot_user
```

### High Memory Usage

```bash
# Check memory
pm2 monit

# Restart if needed
pm2 restart discord-bot
```

### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Restart PostgreSQL if needed
sudo systemctl restart postgresql
```

## Updating the Bot

```bash
# Stop bot
pm2 stop discord-bot

# Pull latest changes
git pull origin main

# Install new dependencies
npm install --production

# Run database migrations (if any)
# npm run migrate

# Start bot
pm2 start discord-bot

# Or reload (zero-downtime)
pm2 reload discord-bot
```

## Rollback Procedure

```bash
# Stop bot
pm2 stop discord-bot

# Checkout previous version
git log --oneline  # Find commit hash
git checkout <commit-hash>

# Restore dependencies
npm install --production

# Restore database (if needed)
# See backup/recovery section

# Restart
pm2 start discord-bot
```

## Health Checks

Create a health check script (`healthcheck.js`):

```javascript
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

client.connect()
  .then(() => {
    console.log('✅ Database OK');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database Error:', err);
    process.exit(1);
  });
```

## Production Checklist

Before going live:

- [ ] `NODE_ENV=production` is set
- [ ] All environment variables configured
- [ ] Database secured with strong password
- [ ] SSL/TLS enabled for database
- [ ] `.env` file has restrictive permissions (600)
- [ ] Firewall configured
- [ ] PM2 configured for auto-restart
- [ ] PM2 startup script configured
- [ ] Logging configured and tested
- [ ] Backup system in place
- [ ] Monitoring set up
- [ ] Bot tested in production environment
- [ ] Rollback procedure documented
- [ ] Team notified of deployment

## Support

For deployment issues:
- Check logs: `pm2 logs discord-bot`
- Review [Troubleshooting](#troubleshooting-production-issues)
- Open an issue on GitHub

---

**Happy Deploying! 🚀**
