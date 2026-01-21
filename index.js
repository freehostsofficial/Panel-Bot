const { Collection, Client, EmbedBuilder } = require("discord.js");
const config = require("./config");
const { loadSlashCommands } = require("./Src/Handlers/slashCommands");
const { loadEvents } = require("./Src/Handlers/events");
const db = require("./Src/Functions/database");
const { loadAntiCrash } = require("./Src/Handlers/antiCrash");
const clientSettingsObject = require("./Src/Functions/clientSettingsObject");
const colors = require("colors");

// Optimized loading sequence
async function initializeBot() {
  try {
    console.log("🚀 Bot startup initiated...");

    // Parallel initialization
    const [token] = await Promise.all([
      Promise.resolve(config.get("settings.bot.token")?.trim()),
      db.instance.initialize().catch(console.error),
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

  const shutdown = async (signal) => {
    console.log(`⚡ Shutdown signal received: ${signal}`);

    if (client) {
      console.log("👋 Disconnecting from Discord...");
      await client.destroy().catch(() => { });
    }

    console.log("✅ Bot shutdown completed");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT (Ctrl+C)"));
  process.on("SIGTERM", () => shutdown("SIGTERM (Termination signal)"));
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Main execution
(async () => {
  const client = await initializeBot();
  if (client) {
    await setupShutdownHandlers(client);
  }
})();
