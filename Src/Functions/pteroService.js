const { request, Agent } = require('undici');

const agent = new Agent({
  allowH2: true,
  h2c: true,
  keepAliveTimeout: 10000,
  keepAliveMaxTimeout: 60000
});

// Simple in-memory cache with TTL
class SimpleCache {
  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttl = 30000) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

class PteroService {
  constructor() {
    this.cache = new SimpleCache();
    this.requestTimeout = 30000; // 30 seconds
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Validate URL format
   * @private
   */
  _validateUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid panel URL: URL must be a non-empty string');
    }

    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid panel URL: Protocol must be http or https');
      }
    } catch (err) {
      throw new Error(`Invalid panel URL format: ${err.message}`);
    }
  }

  /**
   * Validate API key format
   * @private
   */
  _validateApiKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid API key: Key must be a non-empty string');
    }

    if (key.length < 32) {
      throw new Error('Invalid API key: Key appears to be too short');
    }
  }

  /**
   * Validate server ID format
   * @private
   */
  _validateServerId(serverId) {
    if (!serverId || typeof serverId !== 'string') {
      throw new Error('Invalid server ID: Must be a non-empty string');
    }

    // Pterodactyl server IDs are 8-character alphanumeric identifiers
    if (!/^[a-z0-9]{8}$/i.test(serverId)) {
      throw new Error('Invalid server ID format: Must be an 8-character alphanumeric identifier');
    }
  }

  /**
   * Sleep utility for retry delays
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Determine if error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Retry on network errors or 5xx server errors
    const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'];
    const retryableStatus = error.statusCode >= 500 && error.statusCode < 600;

    return retryableCodes.includes(error.code) || retryableStatus || error.statusCode === 429;
  }

  /**
   * Internal request handler with retry logic
   * @private
   */
  async _request(url, key, method = 'GET', endpoint = '/', data = null, isRaw = false, retryCount = 0) {
    this._validateUrl(url);
    this._validateApiKey(key);

    const fullUrl = `${url.replace(/\/$/, '')}/api/client${endpoint}`;
    const options = {
      method,
      dispatcher: agent,

      headersTimeout: this.requestTimeout,
      bodyTimeout: this.requestTimeout,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'Application/vnd.pterodactyl.v1+json',
        'User-Agent': 'Discord-Pterodactyl-Bot/1.0'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await request(fullUrl, options);

      // Handle 204 No Content responses
      if (response.statusCode === 204) {
        await response.body.dump();
        return null;
      }

      // Handle error responses
      if (response.statusCode >= 400) {
        let errorData;
        const contentType = response.headers['content-type'];

        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.body.json();
          } catch (parseError) {
            await response.body.dump();
            errorData = null;
          }
        } else {
          await response.body.dump();
        }

        // Extract detailed error information
        const errorDetail = errorData?.errors?.[0]?.detail
          || errorData?.message
          || `Request failed with status ${response.statusCode}`;
        const errorCode = errorData?.errors?.[0]?.code || null;

        // Create structured error
        const error = new Error(errorDetail);
        error.statusCode = response.statusCode;
        error.code = errorCode;
        error.pterodactylError = true;
        error.endpoint = endpoint;
        error.method = method;

        // Retry logic for retryable errors
        if (this._isRetryableError(error) && retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
          console.warn(`[PTERO] Request failed (${error.statusCode}), retrying in ${delay}ms... (Attempt ${retryCount + 1}/${this.maxRetries})`);
          await this._sleep(delay);
          return this._request(url, key, method, endpoint, data, isRaw, retryCount + 1);
        }

        throw error;
      }

      // Parse successful response
      if (isRaw) {
        return await response.body.text();
      }

      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        return await response.body.json();
      } else {
        await response.body.dump();
        return null;
      }

    } catch (error) {
      // If already a structured error, re-throw
      if (error.pterodactylError) {
        throw error;
      }

      // Handle connection errors
      if (error.code === 'ECONNREFUSED') {
        const connError = new Error('Unable to connect to the panel. Please check the panel URL and ensure it is accessible.');
        connError.statusCode = 503;
        connError.code = 'ECONNREFUSED';
        throw connError;
      }

      if (error.code === 'ETIMEDOUT') {
        const connError = new Error('Connection timeout. The panel may be slow or unreachable.');
        connError.statusCode = 504;
        connError.code = 'ETIMEDOUT';

        // Retry on timeout
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          console.warn(`[PTERO] Request timed out, retrying in ${delay}ms... (Attempt ${retryCount + 1}/${this.maxRetries})`);
          await this._sleep(delay);
          return this._request(url, key, method, endpoint, data, isRaw, retryCount + 1);
        }

        throw connError;
      }

      if (error.code === 'ENOTFOUND') {
        const connError = new Error('Panel domain not found. Please check the panel URL.');
        connError.statusCode = 404;
        connError.code = 'ENOTFOUND';
        throw connError;
      }

      if (error.code === 'ECONNRESET') {
        const connError = new Error('Connection was reset. The panel may have closed the connection unexpectedly.');
        connError.statusCode = 503;
        connError.code = 'ECONNRESET';

        // Retry on connection reset
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          console.warn(`[PTERO] Connection reset, retrying in ${delay}ms... (Attempt ${retryCount + 1}/${this.maxRetries})`);
          await this._sleep(delay);
          return this._request(url, key, method, endpoint, data, isRaw, retryCount + 1);
        }

        throw connError;
      }

      // Re-throw other errors with context
      const contextError = new Error(`Connection error: ${error.message}`);
      contextError.originalError = error;
      contextError.endpoint = endpoint;
      throw contextError;
    }
  }

  /**
   * Validate an API key and URL by fetching account details
   */
  async validateKey(url, key) {
    try {
      const data = await this._request(url, key, 'GET', '/account');
      return {
        valid: true,
        username: data.attributes.username,
        email: data.attributes.email,
        uuid: data.attributes.uuid
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        statusCode: error.statusCode
      };
    }
  }

  /**
   * List all servers accessible to the user
   * @param {boolean} useCache - Whether to use cached results
   */
  async listServers(url, key, useCache = true) {
    const cacheKey = `servers:${url}:${key}`;

    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const data = await this._request(url, key, 'GET', '/');
    const servers = data.data || [];

    // Cache for 30 seconds
    this.cache.set(cacheKey, servers, 30000);

    return servers;
  }

  /**
   * List all servers from all provided panels
   * @param {Array} panels - Array of panel objects with url and apikey
   */
  async getAllServers(panels) {
    if (!Array.isArray(panels) || panels.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      panels.map(async (panel) => {
        if (!panel.url || !panel.apikey) {
          console.warn('[PTERO] Skipping panel with missing url or apikey');
          return [];
        }

        try {
          const servers = await this.listServers(panel.url, panel.apikey);
          return servers.map(s => ({ ...s, panel }));
        } catch (error) {
          console.error(`[PTERO] Failed to fetch servers from panel ${panel.name || panel.url}:`, error.message);
          return [];
        }
      })
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  /**
   * Get specific server information with resources
   * @param {boolean} useCache - Whether to use cached results
   */
  async getServerInfo(url, key, serverId, useCache = false) {
    this._validateServerId(serverId);

    const cacheKey = `server:${url}:${serverId}`;

    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const [response, resources] = await Promise.all([
      this._request(url, key, 'GET', `/servers/${serverId}`),
      this._request(url, key, 'GET', `/servers/${serverId}/resources`)
    ]);

    const serverInfo = {
      ...response.attributes,
      resources: resources.attributes
    };

    // Cache for 10 seconds
    if (useCache) {
      this.cache.set(cacheKey, serverInfo, 10000);
    }

    return serverInfo;
  }

  /**
   * Send a power action to a server
   * Actions: start, stop, restart, kill
   */
  async sendPowerAction(url, key, serverId, action) {
    this._validateServerId(serverId);

    const validActions = ['start', 'stop', 'restart', 'kill'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid power action: ${action}. Must be one of: ${validActions.join(', ')}`);
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/power`, { signal: action });

    // Invalidate server info cache
    this.cache.delete(`server:${url}:${serverId}`);

    return true;
  }

  /**
   * Send a console command to a server
   */
  async sendCommand(url, key, serverId, command) {
    this._validateServerId(serverId);

    if (!command || typeof command !== 'string') {
      throw new Error('Command must be a non-empty string');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/command`, { command });
    return true;
  }

  /**
   * List server backups
   */
  async listBackups(url, key, serverId) {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/backups`);
    return data.data || [];
  }

  /**
   * Create a new backup
   */
  async createBackup(url, key, serverId, name = null, ignored = []) {
    this._validateServerId(serverId);

    const payload = {};
    if (name) payload.name = name;
    if (Array.isArray(ignored) && ignored.length > 0) payload.ignored = ignored;

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/backups`, payload);
    return data.attributes;
  }

  /**
   * Delete a backup
   */
  async deleteBackup(url, key, serverId, backupId) {
    this._validateServerId(serverId);

    if (!backupId || typeof backupId !== 'string') {
      throw new Error('Backup ID must be a non-empty string');
    }

    await this._request(url, key, 'DELETE', `/servers/${serverId}/backups/${backupId}`);
    return true;
  }

  /**
   * Restore a backup
   */
  async restoreBackup(url, key, serverId, backupId, truncate = false) {
    this._validateServerId(serverId);

    if (!backupId || typeof backupId !== 'string') {
      throw new Error('Backup ID must be a non-empty string');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/backups/${backupId}/restore`, {
      truncate: Boolean(truncate)
    });
    return true;
  }

  /**
   * Toggle backup lock
   */
  async toggleBackupLock(url, key, serverId, backupId) {
    this._validateServerId(serverId);

    if (!backupId || typeof backupId !== 'string') {
      throw new Error('Backup ID must be a non-empty string');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/backups/${backupId}/lock`);
    return data.attributes;
  }

  /**
   * Get backup download link
   */
  async getBackupDownload(url, key, serverId, backupId) {
    this._validateServerId(serverId);

    if (!backupId || typeof backupId !== 'string') {
      throw new Error('Backup ID must be a non-empty string');
    }

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/backups/${backupId}/download`);
    return data.attributes.url;
  }

  /**
   * List server databases
   */
  async listDatabases(url, key, serverId) {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/databases`);
    return data.data || [];
  }

  /**
   * Create a database
   */
  async createDatabase(url, key, serverId, database, remote = '%') {
    this._validateServerId(serverId);

    if (!database || typeof database !== 'string') {
      throw new Error('Database name must be a non-empty string');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/databases`, {
      database,
      remote: remote || '%'
    });
    return data.attributes;
  }

  /**
   * Delete a database
   */
  async deleteDatabase(url, key, serverId, databaseId) {
    this._validateServerId(serverId);

    if (!databaseId || typeof databaseId !== 'string') {
      throw new Error('Database ID must be a non-empty string');
    }

    await this._request(url, key, 'DELETE', `/servers/${serverId}/databases/${databaseId}`);
    return true;
  }

  /**
   * Rotate database password
   */
  async rotateDatabasePassword(url, key, serverId, databaseId) {
    this._validateServerId(serverId);

    if (!databaseId || typeof databaseId !== 'string') {
      throw new Error('Database ID must be a non-empty string');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/databases/${databaseId}/rotate-password`);
    return data.attributes;
  }

  /**
   * List server files in a directory
   */
  async listFiles(url, key, serverId, directory = '/') {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/files/list?directory=${encodeURIComponent(directory)}`);
    return data.data || [];
  }

  /**
   * Get server file content
   */
  async getFileContent(url, key, serverId, filePath) {
    this._validateServerId(serverId);

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string');
    }

    return await this._request(url, key, 'GET', `/servers/${serverId}/files/contents?file=${encodeURIComponent(filePath)}`, null, true);
  }

  /**
   * Write to a file (create or update)
   */
  async writeFile(url, key, serverId, filePath, content) {
    this._validateServerId(serverId);

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string');
    }

    if (content === null || content === undefined) {
      throw new Error('File content cannot be null or undefined');
    }

    // The write endpoint expects raw content, not JSON
    const fullUrl = `${url.replace(/\/$/, '')}/api/client/servers/${serverId}/files/write?file=${encodeURIComponent(filePath)}`;
    const options = {
      method: 'POST',
      dispatcher: agent,

      headersTimeout: this.requestTimeout,
      bodyTimeout: this.requestTimeout,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'text/plain',
        'Accept': 'Application/vnd.pterodactyl.v1+json'
      },
      body: String(content)
    };

    const response = await request(fullUrl, options);

    if (response.statusCode >= 400) {
      await response.body.dump();
      throw new Error(`Failed to write file: HTTP ${response.statusCode}`);
    }

    await response.body.dump();
    return true;
  }

  /**
   * Create a directory
   */
  async createDirectory(url, key, serverId, root, name) {
    this._validateServerId(serverId);

    if (!name || typeof name !== 'string') {
      throw new Error('Directory name must be a non-empty string');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/files/create-folder`, {
      root: root || '/',
      name
    });
    return true;
  }

  /**
   * Rename or move files/directories
   * @param {Array} files - Array of objects with {from: string, to: string}
   */
  async renameFiles(url, key, serverId, root, files) {
    this._validateServerId(serverId);

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Files must be a non-empty array');
    }

    await this._request(url, key, 'PUT', `/servers/${serverId}/files/rename`, {
      root: root || '/',
      files
    });
    return true;
  }

  /**
   * Copy files/directories
   */
  async copyFiles(url, key, serverId, location) {
    this._validateServerId(serverId);

    if (!location || typeof location !== 'string') {
      throw new Error('Location must be a non-empty string');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/files/copy`, { location });
    return true;
  }

  /**
   * Delete files or directories
   * @param {Array} files - Array of file paths
   */
  async deleteFiles(url, key, serverId, root, files) {
    this._validateServerId(serverId);

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Files must be a non-empty array');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/files/delete`, {
      root: root || '/',
      files
    });
    return true;
  }

  /**
   * Compress files into archive
   * @param {Array} files - Array of file paths
   */
  async compressFiles(url, key, serverId, root, files) {
    this._validateServerId(serverId);

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Files must be a non-empty array');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/files/compress`, {
      root: root || '/',
      files
    });
    return data.attributes;
  }

  /**
   * Decompress an archive
   */
  async decompressFile(url, key, serverId, root, file) {
    this._validateServerId(serverId);

    if (!file || typeof file !== 'string') {
      throw new Error('File must be a non-empty string');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/files/decompress`, {
      root: root || '/',
      file
    });
    return true;
  }

  /**
   * Change file permissions
   * @param {Array} files - Array of objects with {file: string, mode: string}
   */
  async changeFilePermissions(url, key, serverId, root, files) {
    this._validateServerId(serverId);

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Files must be a non-empty array');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/files/chmod`, {
      root: root || '/',
      files
    });
    return true;
  }

  /**
   * Pull remote file from URL
   */
  async pullRemoteFile(url, key, serverId, urlToPull, directory = '/') {
    this._validateServerId(serverId);

    if (!urlToPull || typeof urlToPull !== 'string') {
      throw new Error('URL to pull must be a non-empty string');
    }

    // Validate URL format
    try {
      new URL(urlToPull);
    } catch {
      throw new Error('Invalid URL format for remote file');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/files/pull`, {
      url: urlToPull,
      directory: directory || '/'
    });
    return true;
  }

  /**
   * Get upload URL for file upload
   */
  async getUploadUrl(url, key, serverId, directory = '/') {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/files/upload?directory=${encodeURIComponent(directory)}`);
    return data.attributes.url;
  }

  /**
   * Rename a server
   */
  async renameServer(url, key, serverId, name) {
    this._validateServerId(serverId);

    if (!name || typeof name !== 'string') {
      throw new Error('Server name must be a non-empty string');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/settings/rename`, { name });

    // Invalidate cache
    this.cache.delete(`server:${url}:${serverId}`);
    this.cache.delete(`servers:${url}:${key}`);

    return true;
  }

  /**
   * Reinstall a server
   */
  async reinstallServer(url, key, serverId) {
    this._validateServerId(serverId);

    await this._request(url, key, 'POST', `/servers/${serverId}/settings/reinstall`);

    // Invalidate cache
    this.cache.delete(`server:${url}:${serverId}`);

    return true;
  }

  /**
   * List server schedules
   */
  async listSchedules(url, key, serverId) {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/schedules`);
    return data.data || [];
  }

  /**
   * Get specific schedule details
   */
  async getSchedule(url, key, serverId, scheduleId) {
    this._validateServerId(serverId);

    if (!scheduleId || typeof scheduleId !== 'number') {
      throw new Error('Schedule ID must be a number');
    }

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/schedules/${scheduleId}`);
    return data.attributes;
  }

  /**
   * Create a new schedule
   * @param {Object} scheduleData - Object with {name, minute, hour, day_of_week, day_of_month, is_active, only_when_online}
   */
  async createSchedule(url, key, serverId, scheduleData) {
    this._validateServerId(serverId);

    if (!scheduleData || typeof scheduleData !== 'object') {
      throw new Error('Schedule data must be an object');
    }

    if (!scheduleData.name) {
      throw new Error('Schedule name is required');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/schedules`, scheduleData);
    return data.attributes;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(url, key, serverId, scheduleId, scheduleData) {
    this._validateServerId(serverId);

    if (!scheduleId || typeof scheduleId !== 'number') {
      throw new Error('Schedule ID must be a number');
    }

    if (!scheduleData || typeof scheduleData !== 'object') {
      throw new Error('Schedule data must be an object');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/schedules/${scheduleId}`, scheduleData);
    return data.attributes;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(url, key, serverId, scheduleId) {
    this._validateServerId(serverId);

    if (!scheduleId || typeof scheduleId !== 'number') {
      throw new Error('Schedule ID must be a number');
    }

    await this._request(url, key, 'DELETE', `/servers/${serverId}/schedules/${scheduleId}`);
    return true;
  }

  /**
   * Execute a schedule immediately
   */
  async executeSchedule(url, key, serverId, scheduleId) {
    this._validateServerId(serverId);

    if (!scheduleId || typeof scheduleId !== 'number') {
      throw new Error('Schedule ID must be a number');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/schedules/${scheduleId}/execute`);
    return true;
  }

  /**
   * Create a schedule task
   * @param {Object} taskData - Object with {action, payload, time_offset, continue_on_failure}
   * Actions: 'command', 'power', 'backup'
   */
  async createScheduleTask(url, key, serverId, scheduleId, taskData) {
    this._validateServerId(serverId);

    if (!scheduleId || typeof scheduleId !== 'number') {
      throw new Error('Schedule ID must be a number');
    }

    if (!taskData || typeof taskData !== 'object') {
      throw new Error('Task data must be an object');
    }

    const validActions = ['command', 'power', 'backup'];
    if (!validActions.includes(taskData.action)) {
      throw new Error(`Invalid task action: ${taskData.action}. Must be one of: ${validActions.join(', ')}`);
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/schedules/${scheduleId}/tasks`, taskData);
    return data.attributes;
  }

  /**
   * Update a schedule task
   */
  async updateScheduleTask(url, key, serverId, scheduleId, taskId, taskData) {
    this._validateServerId(serverId);

    if (!scheduleId || typeof scheduleId !== 'number') {
      throw new Error('Schedule ID must be a number');
    }

    if (!taskId || typeof taskId !== 'number') {
      throw new Error('Task ID must be a number');
    }

    if (!taskData || typeof taskData !== 'object') {
      throw new Error('Task data must be an object');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/schedules/${scheduleId}/tasks/${taskId}`, taskData);
    return data.attributes;
  }

  /**
   * Delete a schedule task
   */
  async deleteScheduleTask(url, key, serverId, scheduleId, taskId) {
    this._validateServerId(serverId);

    if (!scheduleId || typeof scheduleId !== 'number') {
      throw new Error('Schedule ID must be a number');
    }

    if (!taskId || typeof taskId !== 'number') {
      throw new Error('Task ID must be a number');
    }

    await this._request(url, key, 'DELETE', `/servers/${serverId}/schedules/${scheduleId}/tasks/${taskId}`);
    return true;
  }

  /**
   * Get server allocations
   */
  async listAllocations(url, key, serverId) {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/network/allocations`);
    return data.data || [];
  }

  /**
   * Assign a new allocation to the server
   */
  async assignAllocation(url, key, serverId) {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/network/allocations`);
    return data.attributes;
  }

  /**
   * Set primary allocation
   */
  async setPrimaryAllocation(url, key, serverId, allocationId) {
    this._validateServerId(serverId);

    if (!allocationId || typeof allocationId !== 'number') {
      throw new Error('Allocation ID must be a number');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/network/allocations/${allocationId}/primary`);
    return true;
  }

  /**
   * Update allocation note
   */
  async updateAllocationNote(url, key, serverId, allocationId, notes) {
    this._validateServerId(serverId);

    if (!allocationId || typeof allocationId !== 'number') {
      throw new Error('Allocation ID must be a number');
    }

    await this._request(url, key, 'POST', `/servers/${serverId}/network/allocations/${allocationId}`, {
      notes: notes || ''
    });
    return true;
  }

  /**
   * Remove an allocation
   */
  async removeAllocation(url, key, serverId, allocationId) {
    this._validateServerId(serverId);

    if (!allocationId || typeof allocationId !== 'number') {
      throw new Error('Allocation ID must be a number');
    }

    await this._request(url, key, 'DELETE', `/servers/${serverId}/network/allocations/${allocationId}`);
    return true;
  }

  /**
   * Get server startup variables
   */
  async getStartupVariables(url, key, serverId) {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/startup`);
    return data.data || [];
  }

  /**
   * Update a startup variable
   */
  async updateStartupVariable(url, key, serverId, variableKey, value) {
    this._validateServerId(serverId);

    if (!variableKey || typeof variableKey !== 'string') {
      throw new Error('Variable key must be a non-empty string');
    }

    await this._request(url, key, 'PUT', `/servers/${serverId}/startup/variable`, {
      key: variableKey,
      value: String(value)
    });
    return true;
  }

  /**
   * Get server activity logs
   */
  async getActivityLogs(url, key, serverId) {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/activity`);
    return data.data || [];
  }

  /**
   * List server subusers
   */
  async listSubusers(url, key, serverId) {
    this._validateServerId(serverId);

    const data = await this._request(url, key, 'GET', `/servers/${serverId}/users`);
    return data.data || [];
  }

  /**
   * Create a subuser
   */
  async createSubuser(url, key, serverId, email, permissions) {
    this._validateServerId(serverId);

    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    if (!Array.isArray(permissions)) {
      throw new Error('Permissions must be an array');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/users`, {
      email,
      permissions
    });
    return data.attributes;
  }

  /**
   * Update a subuser's permissions
   */
  async updateSubuser(url, key, serverId, subuserId, permissions) {
    this._validateServerId(serverId);

    if (!subuserId || typeof subuserId !== 'string') {
      throw new Error('Subuser ID must be a non-empty string');
    }

    if (!Array.isArray(permissions)) {
      throw new Error('Permissions must be an array');
    }

    const data = await this._request(url, key, 'POST', `/servers/${serverId}/users/${subuserId}`, {
      permissions
    });
    return data.attributes;
  }

  /**
   * Remove a subuser
   */
  async removeSubuser(url, key, serverId, subuserId) {
    this._validateServerId(serverId);

    if (!subuserId || typeof subuserId !== 'string') {
      throw new Error('Subuser ID must be a non-empty string');
    }

    await this._request(url, key, 'DELETE', `/servers/${serverId}/users/${subuserId}`);
    return true;
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific server
   */
  clearServerCache(url, serverId) {
    this.cache.delete(`server:${url}:${serverId}`);
  }
}

module.exports = new PteroService();