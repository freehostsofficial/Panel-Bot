const db = require('./database');
const ptero = require('./pteroService');

/**
 * Common Pterodactyl helpers for handling multiple panels
 */
module.exports = {
  /**
     * Get all servers for a user across all their panels
     * Standardizes the output to include panel information
     */
  async getUserServers(userId) {
    const userData = await db.getUserData(userId);
    if (!userData.panels || userData.panels.length === 0) {
      return [];
    }
    return await ptero.getAllServers(userData.panels);
  },

  /**
     * Logic for server ID autocomplete across all panels
     */
  async serverAutocomplete(interaction) {
    const userId = interaction.user.id;
    try {
      const servers = await this.getUserServers(userId);
      const focusedValue = interaction.options.getFocused().toLowerCase();

      const filtered = servers
        .filter(s =>
          s.attributes.name.toLowerCase().includes(focusedValue) ||
                    s.attributes.identifier.toLowerCase().includes(focusedValue) ||
                    s.panel.name.toLowerCase().includes(focusedValue)
        )
        .slice(0, 25);

      await interaction.respond(filtered.map(s => ({
        name: `[${s.panel.name}] ${s.attributes.name} (${s.attributes.identifier})`.substring(0, 100),
        // We encode both panel name and server ID to easily resolve later
        value: `${s.panel.name}:${s.attributes.identifier}`
      })));
    } catch (err) {
      console.error('[AUTOCOMPLETE ERROR]', err);
      await interaction.respond([]);
    }
  },

  /**
     * Resolve the specific panel and server ID from the combined autocomplete value
     */
  async resolveServer(interaction, combinedValue = null) {
    const value = combinedValue || interaction.options.getString('id');
    if (!value) {
      return null;
    }

    const userId = interaction.user.id;
    const userData = await db.getUserData(userId);

    // Check if it's the combined format (panelName:serverId)
    if (value.includes(':')) {
      const [panelName, serverId] = value.split(':');
      const panel = userData.panels.find(p => p.name === panelName);
      if (panel) {
        return { panel, serverId };
      }
    }

    // Fallback: search for the server ID across all panels if not in combined format
    // (This handles manual copy-pasting of IDs)
    const allServers = await this.getUserServers(userId);
    const match = allServers.find(s => s.attributes.identifier === value);

    if (match) {
      return { panel: match.panel, serverId: value };
    }

    return null;
  }
};
