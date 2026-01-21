const { request, Agent } = require('undici');

const agent = new Agent({
    allowH2: true,
    h2c: true // Allow non-TLS http2 as well just in case
});

class PteroService {
    /**
     * Internal request handler to handle undici requests and errors
     */
    async _request(url, key, method = 'GET', endpoint = '/', data = null, isRaw = false) {
        const fullUrl = `${url.replace(/\/$/, '')}/api/client${endpoint}`;
        const options = {
            method,
            dispatcher: agent,
            maxRedirs: 5, // Follow redirects
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Accept': 'Application/vnd.pterodactyl.v1+json'
            },
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await request(fullUrl, options);

            if (response.statusCode >= 400) {
                let errorData;
                const contentType = response.headers['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.body.json();
                } else {
                    await response.body.dump();
                }
                const errorDetail = errorData?.errors?.[0]?.detail || `Request failed with status ${response.statusCode}`;
                throw new Error(errorDetail);
            }

            if (isRaw) {
                return await response.body.text();
            }

            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                return await response.body.json();
            } else {
                return await response.body.dump();
            }
        } catch (error) {
            if (error.message && !error.message.includes('undici')) {
                throw error;
            }
            throw new Error(`Connection error: ${error.message}`);
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
                email: data.attributes.email
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * List all servers accessible to the user
     */
    async listServers(url, key) {
        const data = await this._request(url, key, 'GET', '/');
        return data.data;
    }

    /**
     * List all servers from all provided panels
     */
    async getAllServers(panels) {
        const results = await Promise.allSettled(
            panels.map(async (panel) => {
                const servers = await this.listServers(panel.url, panel.apikey);
                return servers.map(s => ({ ...s, panel }));
            })
        );

        return results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value);
    }

    /**
     * Get specific server information with resources
     */
    async getServerInfo(url, key, serverId) {
        const [response, resources] = await Promise.all([
            this._request(url, key, 'GET', `/servers/${serverId}`),
            this._request(url, key, 'GET', `/servers/${serverId}/resources`)
        ]);
        return {
            ...response.attributes,
            resources: resources.attributes
        };
    }

    /**
     * Send a power action to a server
     * Actions: start, stop, restart, kill
     */
    async sendPowerAction(url, key, serverId, action) {
        await this._request(url, key, 'POST', `/servers/${serverId}/power`, { signal: action });
        return true;
    }

    /**
     * Send a console command to a server
     */
    async sendCommand(url, key, serverId, command) {
        await this._request(url, key, 'POST', `/servers/${serverId}/command`, { command });
        return true;
    }

    /**
     * List server backups
     */
    async listBackups(url, key, serverId) {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/backups`);
        return data.data;
    }

    /**
     * Create a new backup
     */
    async createBackup(url, key, serverId, name = null) {
        const payload = name ? { name } : {};
        const data = await this._request(url, key, 'POST', `/servers/${serverId}/backups`, payload);
        return data.attributes;
    }

    /**
     * Delete a backup
     */
    async deleteBackup(url, key, serverId, backupId) {
        await this._request(url, key, 'DELETE', `/servers/${serverId}/backups/${backupId}`);
        return true;
    }

    /**
     * List server databases
     */
    async listDatabases(url, key, serverId) {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/databases`);
        return data.data;
    }

    /**
     * Create a database
     */
    async createDatabase(url, key, serverId, database, remote = '%') {
        const data = await this._request(url, key, 'POST', `/servers/${serverId}/databases`, { database, remote });
        return data.attributes;
    }

    /**
     * Delete a database
     */
    async deleteDatabase(url, key, serverId, databaseId) {
        await this._request(url, key, 'DELETE', `/servers/${serverId}/databases/${databaseId}`);
        return true;
    }

    /**
     * Rotate database password
     */
    async rotateDatabasePassword(url, key, serverId, databaseId) {
        const data = await this._request(url, key, 'POST', `/servers/${serverId}/databases/${databaseId}/rotate-password`);
        return data.attributes;
    }

    /**
     * List server files in a directory
     */
    async listFiles(url, key, serverId, directory = '/') {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/files/list?directory=${encodeURIComponent(directory)}`);
        return data.data;
    }

    /**
     * Get server file content
     */
    async getFileContent(url, key, serverId, filePath) {
        return await this._request(url, key, 'GET', `/servers/${serverId}/files/contents?file=${encodeURIComponent(filePath)}`, null, true);
    }

    /**
     * Rename a server
     */
    async renameServer(url, key, serverId, name) {
        await this._request(url, key, 'POST', `/servers/${serverId}/settings/rename`, { name });
        return true;
    }

    /**
     * Reinstall a server
     */
    async reinstallServer(url, key, serverId) {
        await this._request(url, key, 'POST', `/servers/${serverId}/settings/reinstall`);
        return true;
    }

    /**
     * List server schedules
     */
    async listSchedules(url, key, serverId) {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/schedules`);
        return data.data;
    }

    /**
     * Get server allocations
     */
    async listAllocations(url, key, serverId) {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/network/allocations`);
        return data.data;
    }

    /**
     * Get server startup variables
     */
    async getStartupVariables(url, key, serverId) {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/startup`);
        return data.data;
    }

    /**
     * Update a startup variable
     */
    async updateStartupVariable(url, key, serverId, variableKey, value) {
        await this._request(url, key, 'PUT', `/servers/${serverId}/startup/variable`, {
            key: variableKey,
            value: value
        });
        return true;
    }

    /**
     * Get server activity logs
     */
    async getActivityLogs(url, key, serverId) {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/activity`);
        return data.data;
    }

    /**
     * Restore a backup
     */
    async restoreBackup(url, key, serverId, backupId, truncate = false) {
        await this._request(url, key, 'POST', `/servers/${serverId}/backups/${backupId}/restore`, { truncate });
        return true;
    }

    /**
     * Toggle backup lock
     */
    async toggleBackupLock(url, key, serverId, backupId) {
        const data = await this._request(url, key, 'POST', `/servers/${serverId}/backups/${backupId}/lock`);
        return data.attributes;
    }

    /**
     * Get backup download link
     */
    async getBackupDownload(url, key, serverId, backupId) {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/backups/${backupId}/download`);
        return data.attributes.url;
    }

    /**
     * Set primary allocation
     */
    async setPrimaryAllocation(url, key, serverId, allocationId) {
        await this._request(url, key, 'POST', `/servers/${serverId}/network/allocations/${allocationId}/primary`);
        return true;
    }

    /**
     * Update allocation note
     */
    async updateAllocationNote(url, key, serverId, allocationId, notes) {
        await this._request(url, key, 'POST', `/servers/${serverId}/network/allocations/${allocationId}`, { notes });
        return true;
    }

    /**
     * Remove an allocation
     */
    async removeAllocation(url, key, serverId, allocationId) {
        await this._request(url, key, 'DELETE', `/servers/${serverId}/network/allocations/${allocationId}`);
        return true;
    }

    /**
     * List server subusers
     */
    async listSubusers(url, key, serverId) {
        const data = await this._request(url, key, 'GET', `/servers/${serverId}/users`);
        return data.data;
    }

    /**
     * Create a subuser
     */
    async createSubuser(url, key, serverId, email, permissions) {
        const data = await this._request(url, key, 'POST', `/servers/${serverId}/users`, { email, permissions });
        return data.attributes;
    }

    /**
     * Update a subuser's permissions
     */
    async updateSubuser(url, key, serverId, subuserId, permissions) {
        const data = await this._request(url, key, 'POST', `/servers/${serverId}/users/${subuserId}`, { permissions });
        return data.attributes;
    }

    /**
     * Remove a subuser
     */
    async removeSubuser(url, key, serverId, subuserId) {
        await this._request(url, key, 'DELETE', `/servers/${serverId}/users/${subuserId}`);
        return true;
    }
}

module.exports = new PteroService();