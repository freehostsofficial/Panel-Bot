const { EmbedBuilder } = require('discord.js');
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
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('[AntiCrash] Unhandled Rejection:', reason);

    // Track crashes
    resetTrackerIfNeeded();
    crashTracker.count++;

    // If too many crashes, exit process
    if (isCrashLimitExceeded()) {
      console.error(`[AntiCrash] Too many crashes (${crashTracker.count}). Exiting to prevent crash loop.`);
      process.exit(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('[AntiCrash] Uncaught Exception:', error);

    // Track crashes
    resetTrackerIfNeeded();
    crashTracker.count++;

    // For critical errors, exit after logging
    if (isCrashLimitExceeded()) {
      console.error(`[AntiCrash] Too many crashes (${crashTracker.count}). Exiting.`);
      setTimeout(() => process.exit(1), 1000); // Give time for logging
    }
  });

  // Optional: handle warnings
  process.on('warning', (warning) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[AntiCrash] Warning:', warning.name, warning.message);
    }
  });
  console.log('✅ Anti-crash handlers initialized');
}

module.exports = { loadAntiCrash };
