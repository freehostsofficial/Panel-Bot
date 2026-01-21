const fs = require("fs").promises;
const path = require("path");
const { EventEmitter } = require("events");

/**
 * Load all Discord.js events from the Events directory
 * @param {Client} client - The Discord client instance
 * @returns {Promise<void>}
 */
async function loadEvents(client) {
  const basePath = path.join(process.cwd(), "Src", "Events");
  
  try {
    await fs.access(basePath);
  } catch {
    console.log("[EVENTS] Events directory not found, skipping...");
    return;
  }

  // Clear existing listeners
  client.removeAllListeners();
  if (client.rest?.removeAllListeners) {
    client.rest.removeAllListeners();
  }
  client.events?.clear?.();

  try {
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const eventFolders = entries.filter(d => d.isDirectory()).map(d => d.name);
    
    let totalCount = 0;
    
    // Load all events in parallel
    await Promise.all(eventFolders.map(async (folder) => {
      const folderPath = path.join(basePath, folder);
      
      try {
        const files = await fs.readdir(folderPath, { withFileTypes: true });
        const eventFiles = files
          .filter(e => e.isFile() && e.name.endsWith(".js"))
          .map(e => path.join(folderPath, e.name));
        
        await Promise.all(eventFiles.map(async (filePath) => {
          try {
            // Clear cache and load module
            delete require.cache[require.resolve(filePath)];
            const event = require(filePath);
            
            if (!event?.name || typeof event.execute !== "function") {
              return;
            }
            
            // Store event
            if (!client.events) {
              client.events = new Map();
            }
            client.events.set(event.name, event);
            
            // Register event listener
            const emitter = event.rest && client.rest ? client.rest : client;
            const method = event.once ? "once" : "on";
            
            emitter[method](event.name, async (...args) => {
              try {
                await event.execute(...args, client);
              } catch (error) {
                console.error(`[EVENTS] Error executing event ${event.name}:`, error.message);
              }
            });
            
            totalCount++;
          } catch (err) {
            console.error(`[EVENTS] Failed to load ${path.basename(filePath)}:`, err.message);
          }
        }));
      } catch (err) {
        console.error(`[EVENTS] Failed to read folder ${folder}:`, err.message);
      }
    }));
    
    console.log(`[EVENTS] Loaded ${totalCount} events`);
  } catch (error) {
    console.error("[EVENTS] Critical error:", error);
  }
}

module.exports = { loadEvents };