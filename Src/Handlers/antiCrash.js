const { EmbedBuilder } = require('discord.js');
const { logger } = require('../Functions/logger');
const { formatBytes, formatUptime } = require('../Functions/format-utils');

// Track crash occurrences to prevent crash loops
const crashTracker = {
  count: 0,
  resetTime: Date.now() + 60000, // Reset after 1 minute
  maxCrashes: 5
};

/**
 * Reset crash tracker if the window has expired
 */
function resetTrackerIfNeeded() {
  if (Date.now() > crashTracker.resetTime) {
    crashTracker.count = 0;
    crashTracker.resetTime = Date.now() + 60000;
  }
}

/**
 * Check if crash limit has been exceeded
 * @returns {boolean} True if too many crashes have occurred
 */
function isCrashLimitExceeded() {
  return crashTracker.count > crashTracker.maxCrashes;
}

/**
 * Load anti-crash handlers for the Discord client
 * Handles unhandled rejections, uncaught exceptions, warnings, and client errors
 * @param {Client} client - The Discord client instance
 */
function loadAntiCrash(client) {
  // Handle unhandled promise rejections
  process.on("unhandledRejection", async (reason, promise) => {
    console.error("[AntiCrash] Unhandled Rejection:", reason);
    
    // Track crashes
    resetTrackerIfNeeded();
    crashTracker.count++;
    
    // If too many crashes, exit process
    if (isCrashLimitExceeded()) {
      console.error(`[AntiCrash] Too many crashes (${crashTracker.count}). Exiting to prevent crash loop.`);
      process.exit(1);
    }
    
    // Log to Discord if client is available
    if (client?.user) {
      try {
        const errorEmbed = new EmbedBuilder()
          .setAuthor({
            name: "⚠️ Unhandled Promise Rejection",
            iconURL: client.user.displayAvatarURL()
          })
          .setDescription(
            `A promise rejection was not properly handled\n` +
            `**Crash Count:** ${crashTracker.count}/${crashTracker.maxCrashes}`
          )
          .setColor(0xff6600) // Orange for warnings
          .addFields(
            {
              name: "🔍 Error Details",
              value: 
                `\`\`\`js\n` +
                `${String(reason).substring(0, 500)}${String(reason).length > 500 ? '...' : ''}\n` +
                `\`\`\``,
              inline: false
            },
            {
              name: "📊 System Status",
              value:
                `\`\`\`yml\n` +
                `Memory:  ${formatBytes(process.memoryUsage().rss)}\n` +
                `Uptime:  ${formatUptime(process.uptime())}\n` +
                `Node.js: ${process.version}\n` +
                `\`\`\``,
              inline: true
            },
            {
              name: "🛡️ Safety Status",
              value:
                `\`\`\`yml\n` +
                `Crashes:    ${crashTracker.count}\n` +
                `Max Allowed: ${crashTracker.maxCrashes}\n` +
                `Action:     ${crashTracker.count > crashTracker.maxCrashes ? 'Exit' : 'Continue'}\n` +
                `\`\`\``,
              inline: true
            }
          )
          .setFooter({
            text: `Anti-Crash Handler • ${new Date().toLocaleString()}`,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp();

        await logger.error({
          client,
          embed: errorEmbed,
          error: reason instanceof Error ? reason : new Error(String(reason))
        });
      } catch (logError) {
        console.error('[AntiCrash] Failed to log rejection:', logError);
      }
    }
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", async (error) => {
    console.error("[AntiCrash] Uncaught Exception:", error);
    
    // Track crashes
    resetTrackerIfNeeded();
    crashTracker.count++;
    
    // Log to Discord if client is available
    if (client?.user) {
      try {
        const errorEmbed = new EmbedBuilder()
          .setAuthor({
            name: "❌ Critical: Uncaught Exception",
            iconURL: client.user.displayAvatarURL()
          })
          .setDescription(
            `A critical error occurred that was not caught\n` +
            `**Crash Count:** ${crashTracker.count}/${crashTracker.maxCrashes}\n` +
            `**Action:** ${crashTracker.count > crashTracker.maxCrashes ? 'Shutting down' : 'Continuing operation'}`
          )
          .setColor(0xff0000) // Red for critical errors
          .addFields(
            {
              name: "🔥 Exception Details",
              value:
                `\`\`\`js\n` +
                `${error.name}: ${error.message}\n` +
                `\`\`\``,
              inline: false
            },
            {
              name: "📍 Stack Trace (Top 5 lines)",
              value:
                `\`\`\`js\n` +
                `${(error.stack || 'No stack trace available').split('\n').slice(0, 5).join('\n')}\n` +
                `\`\`\``,
              inline: false
            },
            {
              name: "📊 System Status",
              value:
                `\`\`\`yml\n` +
                `Memory:  ${formatBytes(process.memoryUsage().rss)}\n` +
                `Uptime:  ${formatUptime(process.uptime())}\n` +
                `Node.js: ${process.version}\n` +
                `\`\`\``,
              inline: true
            },
            {
              name: "🛡️ Safety Status",
              value:
                `\`\`\`yml\n` +
                `Crashes:     ${crashTracker.count}\n` +
                `Max Allowed: ${crashTracker.maxCrashes}\n` +
                `Will Exit:   ${crashTracker.count > crashTracker.maxCrashes ? 'Yes' : 'No'}\n` +
                `\`\`\``,
              inline: true
            }
          )
          .setFooter({
            text: `Anti-Crash Handler • Critical Error`,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp();

        await logger.error({
          client,
          embed: errorEmbed,
          error
        });
      } catch (logError) {
        console.error('[AntiCrash] Failed to log exception:', logError);
      }
    }
    
    // For critical errors, exit after logging
    if (isCrashLimitExceeded()) {
      console.error(`[AntiCrash] Too many crashes (${crashTracker.count}). Exiting.`);
      setTimeout(() => process.exit(1), 1000); // Give time for logging
    }
  });

  // Optional: handle warnings
  process.on("warning", (warning) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn("[AntiCrash] Warning:", warning.name, warning.message);
    }
  });

  // Discord client error handlers
  if (client) {
    client.on("error", async (error) => {
      console.error("[Discord Client Error]", error);
      
      try {
        const errorEmbed = new EmbedBuilder()
          .setAuthor({
            name: "❌ Discord Client Error",
            iconURL: client.user?.displayAvatarURL()
          })
          .setDescription(
            `The Discord.js client encountered an error\n` +
            `**Error Type:** ${error.name}`
          )
          .setColor(0xff0000) // Red for errors
          .addFields(
            {
              name: "🔍 Error Message",
              value:
                `\`\`\`js\n` +
                `${error.message}\n` +
                `\`\`\``,
              inline: false
            },
            {
              name: "📊 Bot Status",
              value:
                `\`\`\`yml\n` +
                `Guilds:  ${client.guilds?.cache.size || 0}\n` +
                `Users:   ${client.guilds?.cache.reduce((a, g) => a + g.memberCount, 0) || 0}\n` +
                `Ping:    ${client.ws.ping}ms\n` +
                `\`\`\``,
              inline: true
            },
            {
              name: "💻 System Status",
              value:
                `\`\`\`yml\n` +
                `Memory:  ${formatBytes(process.memoryUsage().rss)}\n` +
                `Uptime:  ${formatUptime(process.uptime())}\n` +
                `Node.js: ${process.version}\n` +
                `\`\`\``,
              inline: true
            }
          )
          .setFooter({
            text: `Client Error Handler • ${new Date().toLocaleTimeString()}`,
            iconURL: client.user?.displayAvatarURL()
          })
          .setTimestamp();

        await logger.error({
          client,
          embed: errorEmbed,
          error
        });
      } catch (logError) {
        console.error('[AntiCrash] Failed to log client error:', logError);
      }
    });

    client.on("shardError", async (error, shardId) => {
      console.error(`[Discord Shard Error] Shard ${shardId}:`, error);
      
      try {
        const errorEmbed = new EmbedBuilder()
          .setAuthor({
            name: `❌ Shard ${shardId} Error`,
            iconURL: client.user?.displayAvatarURL()
          })
          .setDescription(
            `A shard encountered an error and may need reconnection\n` +
            `**Shard ID:** ${shardId}\n` +
            `**Error Type:** ${error.name}`
          )
          .setColor(0xff4444) // Light red for shard errors
          .addFields(
            {
              name: "🔍 Error Details",
              value:
                `\`\`\`js\n` +
                `${error.message}\n` +
                `\`\`\``,
              inline: false
            },
            {
              name: "🌐 Shard Information",
              value:
                `\`\`\`yml\n` +
                `Shard ID:     ${shardId}\n` +
                `Total Shards: ${client.shard?.count || 1}\n` +
                `Status:       Error Occurred\n` +
                `\`\`\``,
              inline: true
            },
            {
              name: "📊 System Status",
              value:
                `\`\`\`yml\n` +
                `Memory:  ${formatBytes(process.memoryUsage().rss)}\n` +
                `Uptime:  ${formatUptime(process.uptime())}\n` +
                `Ping:    ${client.ws.ping}ms\n` +
                `\`\`\``,
              inline: true
            }
          )
          .setFooter({
            text: `Shard Error Handler • Shard ${shardId}`,
            iconURL: client.user?.displayAvatarURL()
          })
          .setTimestamp();

        await logger.error({
          client,
          embed: errorEmbed,
          error
        });
      } catch (logError) {
        console.error('[AntiCrash] Failed to log shard error:', logError);
      }
    });
  }
  
  console.log('✅ Anti-crash handlers initialized');
}

module.exports = { loadAntiCrash };
