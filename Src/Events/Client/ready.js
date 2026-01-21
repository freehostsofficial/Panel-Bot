const { ActivityType, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { formatUptime, formatBytes } = require('../../Functions/format-utils');
const db = require('../../Functions/database');
const colors = require('colors');

// Cache for performance
const settingsCache = {};

module.exports = {
  name: 'clientReady',
  once: true,

  async execute(client) {
    try {
      // Initialize database
      await db.instance.initialize();

      // Load settings with caching
      if (!settingsCache.loaded) {
        const SETTINGS_PATH = path.resolve(
          process.cwd(),
          'Src/Settings/settings.json'
        );
        try {
          const data = await fs.readFile(SETTINGS_PATH, 'utf8');
          const settings = JSON.parse(data);

          // Normalize keys to lowercase
          Object.keys(settings).forEach((key) => {
            settings[key.toLowerCase()] = settings[key];
          });

          settingsCache.data = settings;
          settingsCache.loaded = true;
        } catch (err) {
          console.error('Failed to load settings:', err.message);
          settingsCache.data = {};
          settingsCache.loaded = true;
        }
      }

      const settings = settingsCache.data;

      // Display professional console banner
      this.displayConsoleBanner(client);

      // Set up status rotation
      setTimeout(() => this.setupStatusRotation(client, settings), 1000);

      // Send ready embed to Discord
    } catch (err) {
      console.error('ClientReady error:', err);

    }
  },

  /**
   * Display professional ASCII art banner in console
   */
  displayConsoleBanner(client) {
    const guilds = client.guilds.cache;
    const totalGuilds = guilds.size;
    const totalUsers = guilds.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    const commandCount = client.slashCommands?.size || 0;

    console.log('\n');
    console.log(colors.cyan('╔════════════════════════════════════════════════════════════════╗'));
    console.log(colors.cyan('║') + colors.white.bold('                                                                ') + colors.cyan('║'));
    console.log(colors.cyan('║') + colors.green.bold('   ██████╗ ██╗███████╗ ██████╗ ██████╗ ██████╗ ██████╗        ') + colors.cyan('║'));
    console.log(colors.cyan('║') + colors.green.bold('   ██╔══██╗██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗       ') + colors.cyan('║'));
    console.log(colors.cyan('║') + colors.green.bold('   ██║  ██║██║███████╗██║     ██║   ██║██████╔╝██║  ██║       ') + colors.cyan('║'));
    console.log(colors.cyan('║') + colors.green.bold('   ██║  ██║██║╚════██║██║     ██║   ██║██╔══██╗██║  ██║       ') + colors.cyan('║'));
    console.log(colors.cyan('║') + colors.green.bold('   ██████╔╝██║███████║╚██████╗╚██████╔╝██║  ██║██████╔╝       ') + colors.cyan('║'));
    console.log(colors.cyan('║') + colors.green.bold('   ╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝        ') + colors.cyan('║'));
    console.log(colors.cyan('║') + colors.yellow.bold('                      BOT TEMPLATE                              ') + colors.cyan('║'));
    console.log(colors.cyan('║') + colors.white.bold('                                                                ') + colors.cyan('║'));
    console.log(colors.cyan('╚════════════════════════════════════════════════════════════════╝'));
    console.log('\n');

    // Bot Information
    console.log(colors.cyan.bold('📊 Bot Information'));
    console.log(colors.gray('━'.repeat(64)));
    console.log(colors.white('  Username:       ') + colors.green.bold(client.user.tag));
    console.log(colors.white('  ID:             ') + colors.yellow(client.user.id));
    console.log(colors.white('  Environment:    ') + colors.magenta.bold(process.env.NODE_ENV || 'development'));
    console.log('\n');

    // Statistics
    console.log(colors.cyan.bold('📈 Statistics'));
    console.log(colors.gray('━'.repeat(64)));
    console.log(colors.white('  Guilds:         ') + colors.green.bold(totalGuilds.toString()));
    console.log(colors.white('  Users:          ') + colors.green.bold(totalUsers.toLocaleString()));
    console.log(colors.white('  Commands:       ') + colors.green.bold(commandCount.toString()));
    console.log(colors.white('  Ping:           ') + colors.yellow.bold(`${client.ws.ping}ms`));
    console.log('\n');

    // System Information
    console.log(colors.cyan.bold('💻 System Information'));
    console.log(colors.gray('━'.repeat(64)));
    console.log(colors.white('  Node.js:        ') + colors.blue(process.version));
    console.log(colors.white('  Memory Usage:   ') + colors.yellow(formatBytes(process.memoryUsage().rss)));
    console.log(colors.white('  Platform:       ') + colors.blue(`${process.platform} ${process.arch}`));
    console.log(colors.white('  Uptime:         ') + colors.green(formatUptime(process.uptime())));
    console.log('\n');

    console.log(colors.green.bold('✅ Bot is now online and ready!'));
    console.log(colors.gray('━'.repeat(64)));
    console.log('\n');
  },

  async setupStatusRotation(client, settings) {
    const STATUS_ROTATION_INTERVAL =
      Number(settings.statusrotationintervalms) || 60000;

    const activityTypeMap = {
      Playing: ActivityType.Playing,
      Watching: ActivityType.Watching,
      Listening: ActivityType.Listening,
      Competing: ActivityType.Competing
    };

    let statuses = [];
    if (Array.isArray(settings.statuses)) {
      statuses = settings.statuses.map((s) => ({
        text: s.text,
        type: activityTypeMap[s.type] || ActivityType.Playing,
        status: ['online', 'idle', 'dnd', 'invisible'].includes(s.status)
          ? s.status
          : 'online'
      }));
    }

    if (!statuses.length) {
      return;
    }

    let index = 0;

    const setNextStatus = () => {
      if (!client.user || !statuses[index]) {
        return;
      }

      const status = statuses[index];
      const map = {
        guilds: String(client.guilds.cache.size),
        users: String(
          client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0)
        ),
        uptime: formatUptime(process.uptime()),
        memory: formatBytes(process.memoryUsage().heapUsed),
        version: require('../../../package.json').version,
        shards: client.shard ? client.shard.count : 1,
        devs: settings.developer?.ids?.length || 0,
        bot: client.user.tag
      };

      const renderedText = String(status.text).replace(
        /{([^}]+)}/gi,
        (_, key) => {
          const k = Object.keys(map).find(
            (x) => x.toLowerCase() === key.toLowerCase()
          );
          return k ? map[k] : `{${key}}`;
        }
      );

      try {
        client.user.setPresence({
          activities: [{ name: renderedText, type: status.type }],
          status: status.status
        });
      } catch (err) {
        console.error('Failed to set presence:', err);
      }

      index = (index + 1) % statuses.length;
    };

    // Set initial status
    setNextStatus();

    // Rotate statuses
    client.statusInterval = setInterval(
      setNextStatus,
      STATUS_ROTATION_INTERVAL
    );
  }
};
