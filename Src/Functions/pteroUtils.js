const db = require('./database');
const ptero = require('./pteroService');

// Simple cache for user servers to reduce database and API calls
const userServersCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Common Pterodactyl helpers for handling multiple panels
 */
module.exports = {
  /**
   * Get all servers for a user across all their panels
   * Standardizes the output to include panel information
   * @param {string} userId - Discord user ID
   * @param {boolean} useCache - Whether to use cached results (default: true)
   * @param {Object} options - Extra options (timeout, etc.)
   * @returns {Promise<Array>} Array of server objects with panel information
   */
  async getUserServers(userId, useCache = true, options = {}) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }

    // Check cache first
    if (useCache) {
      const cached = userServersCache.get(userId);
      if (cached && Date.now() < cached.expiry) {
        return cached.servers;
      }
    }

    try {
      const userData = await db.getUserData(userId);

      if (!userData || !userData.panels || !Array.isArray(userData.panels)) {
        return [];
      }

      if (userData.panels.length === 0) {
        return [];
      }

      // Filter out invalid panels
      const validPanels = userData.panels.filter(panel =>
        panel &&
        panel.url &&
        typeof panel.url === 'string' &&
        panel.apikey &&
        typeof panel.apikey === 'string'
      );

      if (validPanels.length === 0) {
        console.warn(`[PTERO UTILS] User ${userId} has no valid panels configured`);
        return [];
      }

      // Track which panels failed (for logging)
      const totalPanels = validPanels.length;
      const servers = await ptero.getAllServers(validPanels, options);

      // Log if some panels failed but others succeeded
      if (servers.length === 0 && totalPanels > 0) {
        console.warn(`[PTERO UTILS] User ${userId}: All ${totalPanels} panel(s) failed to return servers`);
      }

      // Cache the results
      if (useCache) {
        userServersCache.set(userId, {
          servers,
          expiry: Date.now() + CACHE_TTL
        });
      }

      return servers;
    } catch (error) {
      console.error(`[PTERO UTILS] Error getting user servers for ${userId}:`, error.message);
      throw new Error(`Failed to retrieve servers: ${error.message}`);
    }
  },

  /**
   * Logic for server ID autocomplete across all panels
   * @param {Interaction} interaction - Discord autocomplete interaction
   */
  async serverAutocomplete(interaction) {
    if (!interaction || !interaction.user) {
      console.error('[PTERO UTILS] Invalid interaction object');
      return;
    }

    const userId = interaction.user.id;

    try {
      // Get user data first to check panels
      const userData = await db.getUserData(userId);

      if (!userData || !userData.panels || !Array.isArray(userData.panels) || userData.panels.length === 0) {
        await interaction.respond([{
          name: 'No panels linked. Use /panel link to add one',
          value: 'no_panels'
        }]).catch(() => { });
        return;
      }

      // Get servers - with short timeout for autocomplete
      const servers = await this.getUserServers(userId, true, { timeout: 2500 });

      if (!servers || servers.length === 0) {
        // Check if this is because of errors or just no servers
        const validPanelsCount = userData.panels.filter(p => p && p.url && p.apikey).length;

        if (validPanelsCount === 0) {
          await interaction.respond([{
            name: 'No valid panels configured. Check your panel credentials',
            value: 'no_valid_panels'
          }]).catch(() => { });
          return;
        }

        // Panels exist but no servers found
        await interaction.respond([{
          name: 'No servers found on any linked panels',
          value: 'no_servers'
        }]).catch(() => { });
        return;
      }

      const focusedValue = interaction.options.getFocused().toLowerCase();

      // Filter and validate server data
      const filtered = servers
        .filter(s => {
          if (!s || !s.attributes || !s.panel) return false;

          const name = (s.attributes.name || '').toLowerCase();
          const identifier = (s.attributes.identifier || '').toLowerCase();
          const panelName = (s.panel.name || '').toLowerCase();

          return name.includes(focusedValue) ||
            identifier.includes(focusedValue) ||
            panelName.includes(focusedValue);
        })
        .slice(0, 25); // Discord limit

      if (filtered.length === 0) {
        // Provide helpful message when no matches
        const totalServers = servers.length;
        await interaction.respond([{
          name: `No matches found (${totalServers} server${totalServers !== 1 ? 's' : ''} available)`,
          value: 'no_match'
        }]).catch(() => { });
        return;
      }

      // Return formatted autocomplete results
      await interaction.respond(filtered.map(s => {
        const serverName = s.attributes.name || 'Unknown Server';
        const serverId = s.attributes.identifier || 'unknown';
        const panelName = s.panel.name || 'Unknown Panel';

        // Format: [Panel] Server Name (identifier)
        const displayName = `[${panelName}] ${serverName} (${serverId})`;

        return {
          name: displayName.substring(0, 100), // Discord limit
          value: `${panelName}:${serverId}` // Combined format for easy resolution
        };
      })).catch(() => { });

    } catch (err) {
      console.error('[PTERO UTILS] Autocomplete error:', err);

      // Only show error if we can respond, otherwise silently fail
      try {
        await interaction.respond([{
          name: 'Error loading servers. Try again in a moment',
          value: 'error'
        }]);
      } catch (respondErr) {
        console.error('[PTERO UTILS] Failed to send autocomplete error:', respondErr);
      }
    }
  },

  /**
   * Resolve the specific panel and server ID from the combined autocomplete value
   * @param {Interaction} interaction - Discord interaction
   * @param {string|null} combinedValue - Optional override value (panelName:serverId)
   * @returns {Promise<Object|null>} Object with {panel, serverId} or null if not found
   */
  async resolveServer(interaction, combinedValue = null) {
    if (!interaction || !interaction.user) {
      throw new Error('Invalid interaction object');
    }

    const value = combinedValue || interaction.options.getString('id');

    if (!value || typeof value !== 'string') {
      return null;
    }

    // Handle special autocomplete values
    const invalidValues = ['no_servers', 'no_match', 'error', 'no_panels', 'no_valid_panels'];
    if (invalidValues.includes(value)) {
      return null;
    }

    const userId = interaction.user.id;

    try {
      const userData = await db.getUserData(userId);

      if (!userData || !userData.panels || !Array.isArray(userData.panels)) {
        return null;
      }

      // Check if it's the combined format (panelName:serverId)
      if (value.includes(':')) {
        const parts = value.split(':');

        if (parts.length !== 2) {
          console.warn(`[PTERO UTILS] Invalid combined value format: ${value}`);
          return null;
        }

        const [panelName, serverId] = parts;

        const panel = userData.panels.find(p =>
          p && p.name === panelName && p.url && p.apikey
        );

        if (panel) {
          return { panel, serverId };
        }

        console.warn(`[PTERO UTILS] Panel not found: ${panelName}`);
      }

      // Fallback: search for the server ID across all panels
      // (This handles manual copy-pasting of IDs)
      const allServers = await this.getUserServers(userId);

      if (!allServers || allServers.length === 0) {
        return null;
      }

      const match = allServers.find(s =>
        s &&
        s.attributes &&
        s.attributes.identifier === value
      );

      if (match && match.panel) {
        return {
          panel: match.panel,
          serverId: value
        };
      }

      console.warn(`[PTERO UTILS] Server not found with ID: ${value}`);
      return null;
    } catch (error) {
      console.error('[PTERO UTILS] Error resolving server:', error);
      throw new Error(`Failed to resolve server: ${error.message}`);
    }
  },

  /**
   * Get a specific server by ID across all user panels
   * @param {string} userId - Discord user ID
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object|null>} Server object or null if not found
   */
  async getServerById(userId, serverId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }

    if (!serverId || typeof serverId !== 'string') {
      throw new Error('Server ID must be a non-empty string');
    }

    try {
      const servers = await this.getUserServers(userId);

      const server = servers.find(s =>
        s &&
        s.attributes &&
        s.attributes.identifier === serverId
      );

      return server || null;
    } catch (error) {
      console.error('[PTERO UTILS] Error getting server by ID:', error);
      throw new Error(`Failed to get server: ${error.message}`);
    }
  },

  /**
   * Get panel by name for a user
   * @param {string} userId - Discord user ID
   * @param {string} panelName - Panel name
   * @returns {Promise<Object|null>} Panel object or null if not found
   */
  async getPanelByName(userId, panelName) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }

    if (!panelName || typeof panelName !== 'string') {
      throw new Error('Panel name must be a non-empty string');
    }

    try {
      const userData = await db.getUserData(userId);

      if (!userData || !userData.panels || !Array.isArray(userData.panels)) {
        return null;
      }

      const panel = userData.panels.find(p =>
        p && p.name === panelName
      );

      return panel || null;
    } catch (error) {
      console.error('[PTERO UTILS] Error getting panel by name:', error);
      throw new Error(`Failed to get panel: ${error.message}`);
    }
  },

  /**
   * Validate that a user has access to a specific server
   * @param {string} userId - Discord user ID
   * @param {string} serverId - Server identifier
   * @returns {Promise<boolean>} True if user has access
   */
  async validateServerAccess(userId, serverId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }

    if (!serverId || typeof serverId !== 'string') {
      throw new Error('Server ID must be a non-empty string');
    }

    try {
      const server = await this.getServerById(userId, serverId);
      return server !== null;
    } catch (error) {
      console.error('[PTERO UTILS] Error validating server access:', error);
      return false;
    }
  },

  /**
   * Get count of servers across all panels for a user
   * @param {string} userId - Discord user ID
   * @returns {Promise<number>} Number of servers
   */
  async getServerCount(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }

    try {
      const servers = await this.getUserServers(userId);
      return servers.length;
    } catch (error) {
      console.error('[PTERO UTILS] Error getting server count:', error);
      return 0;
    }
  },

  /**
   * Group servers by panel
   * @param {string} userId - Discord user ID
   * @returns {Promise<Object>} Object with panel names as keys and server arrays as values
   */
  async groupServersByPanel(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }

    try {
      const servers = await this.getUserServers(userId);
      const grouped = {};

      servers.forEach(server => {
        if (!server || !server.panel) return;

        const panelName = server.panel.name || 'Unknown Panel';

        if (!grouped[panelName]) {
          grouped[panelName] = [];
        }

        grouped[panelName].push(server);
      });

      return grouped;
    } catch (error) {
      console.error('[PTERO UTILS] Error grouping servers:', error);
      return {};
    }
  },

  /**
   * Search servers by name or identifier
   * @param {string} userId - Discord user ID
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of matching servers
   */
  async searchServers(userId, query) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }

    if (!query || typeof query !== 'string') {
      return [];
    }

    try {
      const servers = await this.getUserServers(userId);
      const lowerQuery = query.toLowerCase();

      return servers.filter(s => {
        if (!s || !s.attributes) return false;

        const name = (s.attributes.name || '').toLowerCase();
        const identifier = (s.attributes.identifier || '').toLowerCase();

        return name.includes(lowerQuery) || identifier.includes(lowerQuery);
      });
    } catch (error) {
      console.error('[PTERO UTILS] Error searching servers:', error);
      return [];
    }
  },

  /**
   * Format server info for display
   * @param {Object} server - Server object
   * @returns {string} Formatted server info
   */
  formatServerInfo(server) {
    if (!server || !server.attributes) {
      return 'Unknown Server';
    }

    const name = server.attributes.name || 'Unknown';
    const identifier = server.attributes.identifier || 'unknown';
    const panelName = server.panel?.name || 'Unknown Panel';

    return `**${name}** (${identifier}) - Panel: ${panelName}`;
  },

  /**
   * Format server status for display
   * @param {Object} resources - Server resources object
   * @returns {string} Formatted status
   */
  formatServerStatus(resources) {
    if (!resources) {
      return 'Unknown';
    }

    const state = resources.current_state || 'unknown';
    const statusEmojis = {
      'running': '🟢 Online',
      'starting': '🟡 Starting',
      'stopping': '🟡 Stopping',
      'offline': '🔴 Offline',
      'unknown': '⚪ Unknown'
    };

    return statusEmojis[state] || '⚪ Unknown';
  },

  /**
   * Format bytes to human-readable size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (typeof bytes !== 'number' || bytes < 0) return 'N/A';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  },

  /**
   * Format resource usage as percentage
   * @param {number} current - Current usage
   * @param {number} limit - Resource limit (0 for unlimited)
   * @returns {string} Formatted percentage
   */
  formatResourceUsage(current, limit) {
    if (typeof current !== 'number' || current < 0) {
      return 'N/A';
    }

    if (limit === 0 || limit === null || limit === undefined) {
      return `${current} (Unlimited)`;
    }

    const percentage = (current / limit) * 100;
    return `${current}/${limit} (${percentage.toFixed(1)}%)`;
  },

  /**
   * Clear cached servers for a user
   * @param {string} userId - Discord user ID
   */
  clearUserCache(userId) {
    if (!userId || typeof userId !== 'string') {
      return;
    }

    userServersCache.delete(userId);
    console.log(`[PTERO UTILS] Cleared cache for user ${userId}`);
  },

  /**
   * Clear all cached data
   */
  clearAllCache() {
    userServersCache.clear();
    ptero.clearCache();
    console.log('[PTERO UTILS] Cleared all caches');
  },

  /**
   * Check if user has any panels configured
   * @param {string} userId - Discord user ID
   * @returns {Promise<boolean>} True if user has panels
   */
  async hasPanels(userId) {
    if (!userId || typeof userId !== 'string') {
      return false;
    }

    try {
      const userData = await db.getUserData(userId);
      return !!(userData &&
        userData.panels &&
        Array.isArray(userData.panels) &&
        userData.panels.length > 0);
    } catch (error) {
      console.error('[PTERO UTILS] Error checking panels:', error);
      return false;
    }
  },

  /**
   * Get panel count for a user
   * @param {string} userId - Discord user ID
   * @returns {Promise<number>} Number of panels
   */
  async getPanelCount(userId) {
    if (!userId || typeof userId !== 'string') {
      return 0;
    }

    try {
      const userData = await db.getUserData(userId);
      return userData?.panels?.length || 0;
    } catch (error) {
      console.error('[PTERO UTILS] Error getting panel count:', error);
      return 0;
    }
  },

  /**
   * Validate server ID format
   * @param {string} serverId - Server identifier
   * @returns {boolean} True if valid format
   */
  isValidServerId(serverId) {
    if (!serverId || typeof serverId !== 'string') {
      return false;
    }

    // Pterodactyl server IDs are 8-character alphanumeric identifiers
    return /^[a-z0-9]{8}$/i.test(serverId);
  },

  /**
   * Extract server ID from combined value (panelName:serverId)
   * @param {string} combinedValue - Combined value
   * @returns {string|null} Server ID or null
   */
  extractServerId(combinedValue) {
    if (!combinedValue || typeof combinedValue !== 'string') {
      return null;
    }

    if (combinedValue.includes(':')) {
      const parts = combinedValue.split(':');
      return parts.length === 2 ? parts[1] : null;
    }

    return combinedValue;
  },

  /**
   * Panel autocomplete for panel management commands
   * @param {Interaction} interaction - Discord autocomplete interaction
   */
  async panelAutocomplete(interaction) {
    if (!interaction || !interaction.user) {
      console.error('[PTERO UTILS] Invalid interaction object');
      return;
    }

    const userId = interaction.user.id;

    try {
      const userData = await db.getUserData(userId);

      if (!userData || !userData.panels || userData.panels.length === 0) {
        await interaction.respond([{
          name: 'No panels configured. Use /panel add to create one',
          value: 'no_panels'
        }]).catch(() => { });
        return;
      }

      const focusedValue = interaction.options.getFocused().toLowerCase();

      // Filter panels by name
      const filtered = userData.panels
        .filter(p => p.name.toLowerCase().includes(focusedValue))
        .slice(0, 25)
        .map(p => {
          const status = p.active === false ? '❌ ' : '✅ ';
          return {
            name: `${status}${p.name}`,
            value: p.name
          };
        });

      if (filtered.length === 0) {
        await interaction.respond([{
          name: 'No matching panels found',
          value: 'no_match'
        }]).catch(() => { });
        return;
      }

      await interaction.respond(filtered).catch(() => { });
    } catch (err) {
      console.error('[PTERO UTILS] Panel autocomplete error:', err);
      await interaction.respond([{
        name: 'Error loading panels',
        value: 'error'
      }]).catch(() => { });
    }
  },

  /**
   * Extract panel name from combined value (panelName:serverId)
   * @param {string} combinedValue - Combined value
   * @returns {string|null} Panel name or null
   */
  extractPanelName(combinedValue) {
    if (!combinedValue || typeof combinedValue !== 'string') {
      return null;
    }

    if (combinedValue.includes(':')) {
      const parts = combinedValue.split(':');
      return parts.length === 2 ? parts[0] : null;
    }

    return null;
  },

  /**
   * Format allocation info for display
   * @param {Object} allocation - Allocation object
   * @returns {string} Formatted allocation info
   */
  formatAllocation(allocation) {
    if (!allocation || !allocation.attributes) {
      return 'Unknown Allocation';
    }

    const ip = allocation.attributes.ip || 'unknown';
    const port = allocation.attributes.port || 'unknown';
    const alias = allocation.attributes.alias || null;
    const isPrimary = allocation.attributes.is_default || false;

    const primaryBadge = isPrimary ? '⭐ ' : '';
    const aliasText = alias ? ` (${alias})` : '';

    return `${primaryBadge}${ip}:${port}${aliasText}`;
  },

  /**
   * Format subuser info for display
   * @param {Object} subuser - Subuser object
   * @returns {string} Formatted subuser info
   */
  formatSubuser(subuser) {
    if (!subuser || !subuser.attributes) {
      return 'Unknown User';
    }

    const email = subuser.attributes.email || 'unknown';
    const uuid = subuser.attributes.uuid || '';
    const image = subuser.attributes.image || '';
    const created = subuser.attributes.created_at || '';

    return `**${email}** (${uuid.substring(0, 8)})`;
  },

  /**
   * Common server permission sets
   */
  PERMISSIONS: {
    // Control permissions
    CONTROL_CONSOLE: 'control.console',
    CONTROL_START: 'control.start',
    CONTROL_STOP: 'control.stop',
    CONTROL_RESTART: 'control.restart',

    // File permissions
    FILE_READ: 'file.read',
    FILE_READ_CONTENT: 'file.read-content',
    FILE_CREATE: 'file.create',
    FILE_UPDATE: 'file.update',
    FILE_DELETE: 'file.delete',
    FILE_ARCHIVE: 'file.archive',
    FILE_SFTP: 'file.sftp',

    // Backup permissions
    BACKUP_READ: 'backup.read',
    BACKUP_CREATE: 'backup.create',
    BACKUP_DELETE: 'backup.delete',
    BACKUP_DOWNLOAD: 'backup.download',
    BACKUP_RESTORE: 'backup.restore',

    // Allocation permissions
    ALLOCATION_READ: 'allocation.read',
    ALLOCATION_CREATE: 'allocation.create',
    ALLOCATION_UPDATE: 'allocation.update',
    ALLOCATION_DELETE: 'allocation.delete',

    // Database permissions
    DATABASE_READ: 'database.read',
    DATABASE_CREATE: 'database.create',
    DATABASE_UPDATE: 'database.update',
    DATABASE_DELETE: 'database.delete',
    DATABASE_VIEW_PASSWORD: 'database.view_password',

    // Schedule permissions
    SCHEDULE_READ: 'schedule.read',
    SCHEDULE_CREATE: 'schedule.create',
    SCHEDULE_UPDATE: 'schedule.update',
    SCHEDULE_DELETE: 'schedule.delete',

    // User permissions
    USER_READ: 'user.read',
    USER_CREATE: 'user.create',
    USER_UPDATE: 'user.update',
    USER_DELETE: 'user.delete',

    // Settings permissions
    SETTINGS_RENAME: 'settings.rename',
    SETTINGS_REINSTALL: 'settings.reinstall',
    STARTUP_READ: 'startup.read',
    STARTUP_UPDATE: 'startup.update',
    STARTUP_DOCKER_IMAGE: 'startup.docker-image',

    // Activity permissions
    ACTIVITY_READ: 'activity.read',

    // Admin-level access (all permissions)
    ALL: '*'
  },

  /**
   * Get permission set by role name
   * @param {string} role - Role name (admin, moderator, viewer, developer)
   * @returns {Array} Array of permission strings
   */
  getPermissionsByRole(role) {
    const P = this.PERMISSIONS;

    switch (role.toLowerCase()) {
      case 'admin':
        return [P.ALL];

      case 'moderator':
        return [
          P.CONTROL_CONSOLE, P.CONTROL_START, P.CONTROL_STOP, P.CONTROL_RESTART,
          P.FILE_READ, P.FILE_READ_CONTENT, P.FILE_CREATE, P.FILE_UPDATE,
          P.BACKUP_READ, P.BACKUP_CREATE,
          P.DATABASE_READ, P.DATABASE_VIEW_PASSWORD,
          P.SCHEDULE_READ,
          P.USER_READ,
          P.ACTIVITY_READ
        ];

      case 'viewer':
        return [
          P.CONTROL_CONSOLE,
          P.FILE_READ, P.FILE_READ_CONTENT,
          P.BACKUP_READ,
          P.DATABASE_READ,
          P.SCHEDULE_READ,
          P.USER_READ,
          P.ACTIVITY_READ
        ];

      case 'developer':
        return [
          P.CONTROL_CONSOLE, P.CONTROL_START, P.CONTROL_STOP, P.CONTROL_RESTART,
          P.FILE_READ, P.FILE_READ_CONTENT, P.FILE_CREATE, P.FILE_UPDATE, P.FILE_DELETE,
          P.FILE_ARCHIVE, P.FILE_SFTP,
          P.BACKUP_READ, P.BACKUP_CREATE, P.BACKUP_DOWNLOAD,
          P.DATABASE_READ, P.DATABASE_CREATE, P.DATABASE_UPDATE, P.DATABASE_VIEW_PASSWORD,
          P.SCHEDULE_READ, P.SCHEDULE_CREATE, P.SCHEDULE_UPDATE,
          P.STARTUP_READ, P.STARTUP_UPDATE,
          P.ACTIVITY_READ
        ];

      default:
        return [];
    }
  },

  /**
   * Validate permission string
   * @param {string} permission - Permission string
   * @returns {boolean} True if valid
   */
  isValidPermission(permission) {
    if (!permission || typeof permission !== 'string') {
      return false;
    }

    // Check if it's in the PERMISSIONS list or follows the pattern
    const validPattern = /^[a-z]+\.[a-z-]+$/;
    return permission === '*' || validPattern.test(permission);
  }
};
