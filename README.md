# Discord Bot Template

A secure, production-ready Discord bot template with PostgreSQL support, comprehensive command handling, and best practices for security and code quality.

##  Features

- ⚡**Discord.js v14** with full slash command support
- 🗄️ **PostgreSQL** integration with connection pooling
- 🔒 **Security-first** design with input validation and sanitization
- 🛡️ **Anti-crash** handlers with error recovery
- 📝 **Comprehensive logging** with Discord webhook support
- ⚙️ **Environment-based configuration** for easy deployment
- 🎯 **Permission system** with developer/owner roles
- ⏱️ **Command cooldown** system
- 📊 **Dynamic help menu** with autocomplete
- 🔧 **Easy customization** with modular command structure

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 16.11.0 (LTS recommended)
- **npm** >= 7.0.0
- **PostgreSQL** >= 12.0 (optional, but recommended)
- **Discord Bot Token** from [Discord Developer Portal](https://discord.com/developers/applications)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/ShadowGaming100/Discord-Bot-Template.git
cd Discord-Bot-Template
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your configuration:

```env
# Required
SETTINGS_BOT_TOKEN=your_bot_token_here
SETTINGS_BOT_CLIENTID=your_client_id_here
SETTINGS_DEVELOPER_IDS=your_discord_user_id

# Database (if using PostgreSQL)
SERVER_POSTGRES_HOST=localhost
SERVER_POSTGRES_PORT=5432
SERVER_POSTGRES_USER=your_username
SERVER_POSTGRES_PASSWORD=your_password
SERVER_POSTGRES_DATABASE=your_database
```

See [Environment Variables](#-environment-variables) for the complete list.

### 4. Set Up Database (Optional)

If you're using PostgreSQL, the bot will automatically create the required tables on first run. Make sure your database server is running and accessible.

### 5. Start the Bot

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## 📁 Project Structure

```
Discord-Bot-Template/
├── Src/
│   ├── Commands/
│   │   └── Slash/          # Slash commands organized by category
│   │       └── Info/       # Info category (Bot, Server, User subcategories)
│   ├── Events/
│   │   ├── Client/         # Client events (ready, etc.)
│   │   └── Interaction/    # Interaction events (commands, buttons)
│   ├── Functions/
│   │   ├── database.js     # Database manager
│   │   ├── logger.js       # Discord webhook logger
│   │   ├── validation.js   # Input validation utilities
│   │   └── security-utils.js  # Security helper functions
│   ├── Handlers/
│   │   ├── slashCommands.js   # Command loading and registration
│   │   ├── events.js       # Event handler loader
│   │   └── antiCrash.js    # Error handling and recovery
│   └── Settings/
│       ├── settings.json    # Bot configuration
│       ├── logs.json       # Logging configuration
│       └── server.json     # Server configuration
├── config.js               # Configuration management
├── index.js                # Main entry point
├── .env.example           # Environment variables template
└── package.json
```

## 🎮 Command Structure

Commands are organized into categories with subcommands:

```
/info                      # Main command category
  ├── help [command]      # Help menu
  ├── bot
  │   ├── ping           # Check bot latency
  │   ├── stats          # Bot statistics
  │   └── uptime         # Bot uptime
  ├── server
  │   ├── info           # Server information
  │   ├── membercount    # Member statistics
  │   └── roles          # List server roles
  └── user
      ├── avatar [user]  # User avatar
      ├── whois [user]   # User information
      └── banner [user]  # User banner
```

## 🔧 Adding New Commands

1. Create a new file in `Src/Commands/Slash/[Category]/[Subgroup]/command.js`
2. Export the command structure:

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  name: 'commandname',
  description: 'Command description',
  category: 'Category',
  cooldown: 5, // seconds
  
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Command description'),
  
  async execute(client, interaction) {
    await interaction.reply('Hello!');
  }
};
```

3. Restart the bot - commands are automatically registered!

## 🔐 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SETTINGS_BOT_TOKEN` | Your Discord bot token | `Discord Bot Toekn` |
| `SETTINGS_BOT_CLIENTID` | Your application client ID | `123456789012345678` |
| `SETTINGS_DEVELOPER_IDS` | Comma-separated developer user IDs | `123456789012345678,987654321098765432` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `SERVER_POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `SERVER_POSTGRES_PORT` | PostgreSQL port | `5432` |
| `SERVER_POSTGRES_USER` | Database username | - |
| `SERVER_POSTGRES_PASSWORD` | Database password | - |
| `SERVER_POSTGRES_DATABASE` | Database name | - |
| `DB_DEBUG` | Enable database query logging | `false` |

See `.env.example` for the complete list.

## 🛡️ Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **SQL Injection Protection**: Parameterized queries throughout
- **Error Sanitization**: Stack traces hidden in production
- **Rate Limiting**: Cooldown system per command
- **Permission Checks**: Developer/owner role verification
- **Sensitive Data Protection**: Credentials stored in environment variables only

See [SECURITY.md](SECURITY.md) for detailed security information.

## 📝 Logging

The bot supports logging to Discord webhooks:

1. Create a webhook in your Discord server
2. Add the webhook URL to your `.env`:
   ```env
   LOGS_ERRORLOGS_WEBHOOK=https://discord.com/api/webhooks/...
   LOGS_COMMANDLOGS_WEBHOOK=https://discord.com/api/webhooks/...
   ```
3. Configure logging in `Src/Settings/logs.json`

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run linting:

```bash
npm run lint
```

Format code:

```bash
npm run format
```

## 🚢 Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

Quick deployment checklist:

- [ ] Set `NODE_ENV=production`
- [ ] Configure all required environment variables
- [ ] Set up PostgreSQL database
- [ ] Review and update security configurations
- [ ] Set up process manager (PM2, systemd, etc.)
- [ ] Configure logging
- [ ] Test bot in development environment first

## 🔍 Troubleshooting

### Bot won't start

- **Check your bot token**: Ensure `SETTINGS_BOT_TOKEN` is correct and not expired
- **Verify Node.js version**: Run `node --version` (should be >= 16.11.0)
- **Check database connection**: If using PostgreSQL, ensure the database is running

### Commands not showing in Discord
- **Wait 1 hour**: Discord caches commands
- **Re-invite bot**: Use the invite link with `applications.commands` scope
- **Check bot permissions**: Ensure bot has required permissions in the server

### Database errors

- **Verify credentials**: Check `SERVER_POSTGRES_*` environment variables
- **Check database exists**: Create the database if it doesn't exist
- **Review connection**: Ensure PostgreSQL is accessible from your bot's network

### General debugging

Enable debug mode:
```env
DB_DEBUG=true
NODE_ENV=development
```

Check console output for detailed error messages.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Discord API library
- [node-postgres](https://node-postgres.com/) - PostgreSQL client

## 📧 Support

For issues and questions:
- **Issues**: [GitHub Issues](https://github.com/ShadowGaming100/Discord-Bot-Template/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ShadowGaming100/Discord-Bot-Template/discussions)

---

**Note**: Never commit your `.env` file or share your bot token publicly!