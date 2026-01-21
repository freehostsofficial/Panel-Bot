const fs = require('fs');
const path = require('path');
const config = require('../../config');

class DatabaseManager {
  constructor() {
    this.dataPath = path.join(process.cwd(), 'Src', 'Data', 'database.json');
    this.initialized = false;
    this.data = {};
  }

  /**
   * Initialize database by reading database.json
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf8');
        this.data = JSON.parse(raw || '{}');
      } else {
        this.data = {};
      }

      // Ensure pterodactyl_data structure exists
      if (!this.data.pterodactyl_data) {
        this.data.pterodactyl_data = {
          users: {} // userId: { panels: [], selectedPanel: null }
        };
        this._save();
      }

      this.initialized = true;
      console.log('✅ Database (database.json) initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Internal save method
   */
  _save() {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Failed to save to database.json:', error);
    }
  }

  async _wait() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get panel data for a specific user
   */
  async getUserData(userId) {
    await this._wait();
    if (!this.data.pterodactyl_data.users[userId]) {
      this.data.pterodactyl_data.users[userId] = { panels: [] };
    }
    return this.data.pterodactyl_data.users[userId];
  }

  /**
   * Add or update a panel for a user
   */
  async savePanel(userId, panelData) {
    await this._wait();
    const userData = await this.getUserData(userId);

    const existingIndex = userData.panels.findIndex(p => p.name.toLowerCase() === panelData.name.toLowerCase());

    if (existingIndex !== -1) {
      userData.panels[existingIndex] = { ...userData.panels[existingIndex], ...panelData };
    } else {
      userData.panels.push(panelData);
    }

    this._save();
    return true;
  }

  /**
   * Remove a panel for a user
   */
  async removePanel(userId, panelName) {
    await this._wait();
    const userData = await this.getUserData(userId);

    const initialCount = userData.panels.length;
    userData.panels = userData.panels.filter(p => p.name.toLowerCase() !== panelName.toLowerCase());

    if (userData.panels.length !== initialCount) {
      this._save();
      return true;
    }
    return false;
  }

  async isReady() {
    return this.initialized;
  }
}

const db = new DatabaseManager();

module.exports = {
  getUserData: (userId) => db.getUserData(userId),
  savePanel: (userId, data) => db.savePanel(userId, data),
  removePanel: (userId, name) => db.removePanel(userId, name),
  isReady: () => db.isReady(),
  instance: db
};
