const { Collection, Client, EmbedBuilder } = require("discord.js");
const config = require("./config");
const { loadSlashCommands } = require("./Src/Handlers/slashCommands");
const { loadEvents } = require("./Src/Handlers/events");
const { ensurePostgresTables } = require("./Src/Functions/database");
const { loadAntiCrash } = require("./Src/Handlers/antiCrash");
const clientSettingsObject = require("./Src/Functions/clientSettingsObject");
const colors = require("colors");
const { logger } = require("./Src/Functions/logger");
const { formatUptime } = require("./Src/Functions/format-utils");

// Optimized loading sequence
async function initializeBot() {
  try {
    console.log("🚀 Bot startup initiated...");

    // Parallel initialization
    const [token] = await Promise.all([
      Promise.resolve(config.get("settings.bot.token")?.trim()),
      ensurePostgresTables().catch(console.error),
    ]);

    if (!token) throw new Error("Bot token not defined");

    const client = new Client(clientSettingsObject());

    const collections = [
      "slashCommands",
      "messageCommands",
      "events",
      "categories",
      "cooldowns",
    ];
    collections.forEach((prop) => (client[prop] = new Collection()));

    loadAntiCrash(client, colors);

    await loadEvents(client);

    await client.login(token);

    console.log(`🔑 Logged in as ${client.user.tag}`);

    loadSlashCommands(client);

    return client;
  } catch (error) {
    console.error("❌ Startup error:", error);
    process.exit(1);
  }
}

async function setupShutdownHandlers(client) {
  let botStartTimestamp = Date.now();

  const shutdown = async (signal) => {
    console.log(`⚡ Shutdown signal received: ${signal}`);

    if (client?.user) {
      const guilds = client.guilds.cache;
      const totalGuilds = guilds.size;
      const totalUsers = guilds.reduce(
        (acc, g) => acc + (g.memberCount || 0),
        0
      );
      const botUptime = Date.now() - botStartTimestamp;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: "🛑 Bot Shutdown",
          iconURL: client.user.displayAvatarURL()
        })
        .setDescription(
          `**${client.user.tag}** is shutting down gracefully\n` +
          `Shutdown initiated by **${signal}**`
        )
        .setColor(0xffa500) // Orange for shutdown
        .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
        .addFields(
          {
            name: "📊 Final Server Statistics",
            value:
              `\`\`\`yml\n` +
              `Guilds:   ${totalGuilds.toLocaleString()}\n` +
              `Users:    ${totalUsers.toLocaleString()}\n` +
              `Channels: ${client.channels.cache.size.toLocaleString()}\n` +
              `\`\`\``,
            inline: true
          },
          {
            name: "⏱️ Session Information",
            value:
              `\`\`\`yml\n` +
              `Uptime:       ${formatUptime(botUptime / 1000)}\n` +
              `Shutdown At:  ${new Date().toLocaleTimeString()}\n` +
              `Session Date: ${new Date().toLocaleDateString()}\n` +
              `\`\`\``,
            inline: true
          },
          {
            name: "💻 System Resources",
            value:
              `\`\`\`yml\n` +
              `Memory Used: ${formatBytes(process.memoryUsage().rss)}\n` +
              `Node.js:     ${process.version}\n` +
              `Platform:    ${process.platform}\n` +
              `\`\`\``,
            inline: true
          },
          {
            name: "🔄 Shutdown Details",
            value:
              `\`\`\`yml\n` +
              `Reason:  ${signal}\n` +
              `Status:  Graceful Shutdown\n` +
              `Type:    Clean Exit\n` +
              `\`\`\``,
            inline: false
          }
        )
        .setFooter({
          text: `Bot ID: ${client.user.id} • Discord Bot Template`,
          iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();

      try {
        await logger.client({ client, embed });
      } catch (logError) {
        console.error("Failed to send shutdown log:", logError);
      }
    }

    if (client) {
      console.log("👋 Disconnecting from Discord...");
      await client.destroy().catch(() => {});
    }

    console.log("✅ Bot shutdown completed");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT (Ctrl+C)"));
  process.on("SIGTERM", () => shutdown("SIGTERM (Termination signal)"));
}

// Main execution
(async () => {
  const client = await initializeBot();
  if (client) {
    await setupShutdownHandlers(client);
  }
})();
