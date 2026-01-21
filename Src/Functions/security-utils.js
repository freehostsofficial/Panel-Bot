/**
 * Security Utility Functions
 * Provides security-related helpers for the Discord bot
 */

/**
 * Sanitize error messages for user-facing display
 * Removes sensitive information like file paths, stack traces, etc.
 * @param {Error|string} error - The error to sanitize
 * @param {boolean} isDevelopment - Whether we're in development mode
 * @returns {string} - Safe error message for users
 */
function sanitizeErrorMessage(error, isDevelopment = false) {
  // In development, show more details
  if (isDevelopment && process.env.NODE_ENV !== 'production') {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return String(error);
  }

  // In production, show generic message
  return 'An error occurred. Please try again later.';
}

/**
 * Simple rate limiter using Map
 * @param {Map} store - The Map to store rate limit data
 * @param {string} key - Unique identifier (user ID, IP, etc.)
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {object} - { allowed: boolean, remainingAttempts: number, resetTime: number }
 */
function checkRateLimit(store, key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  const record = store.get(key) || { attempts: 0, resetTime: now + windowMs };

  // Reset if window has passed
  if (now >= record.resetTime) {
    record.attempts = 0;
    record.resetTime = now + windowMs;
  }

  // Check if limit exceeded
  if (record.attempts >= maxAttempts) {
    store.set(key, record);
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime: record.resetTime
    };
  }

  // Increment attempts
  record.attempts++;
  store.set(key, record);

  return {
    allowed: true,
    remainingAttempts: maxAttempts - record.attempts,
    resetTime: record.resetTime
  };
}

/**
 * Clean up expired rate limit entries
 * @param {Map} store - The rate limit store
 */
function cleanupRateLimits(store) {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now >= record.resetTime) {
      store.delete(key);
    }
  }
}

/**
 * Verify user has required permission level
 * @param {string} userId - Discord user ID
 * @param {string[]} allowedIds - Array of allowed user IDs
 * @param {string} level - Permission level name (for error messages)
 * @returns {object} - { allowed: boolean, error: string|null }
 */
function verifyPermissionLevel(userId, allowedIds, level = 'required') {
  const result = {
    allowed: false,
    error: null
  };

  if (!userId) {
    result.error = 'User ID is required';
    return result;
  }

  if (!Array.isArray(allowedIds) || allowedIds.length === 0) {
    result.error = `No ${level} IDs configured`;
    return result;
  }

  const userIdStr = String(userId);
  const allowed = allowedIds.map(String).includes(userIdStr);

  if (!allowed) {
    result.error = `Insufficient permissions: ${level} access required`;
    return result;
  }

  result.allowed = true;
  return result;
}

/**
 * Escape markdown special characters to prevent formatting injection
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeMarkdown(text) {
  if (typeof text !== 'string') return String(text);

  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|')
    .replace(/>/g, '\\>');
}

/**
 * Generate a safe error ID for logging and user reference
 * @returns {string} - Unique error ID (timestamp + random)
 */
function generateErrorId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`.toUpperCase();
}

/**
 * Validate environment configuration has required values
 * @param {object} config - Configuration object
 * @param {string[]} requiredKeys - Array of required key paths (e.g., ['bot.token', 'database.host'])
 * @returns {object} - { valid: boolean, missingKeys: string[], errors: string[] }
 */
function validateRequiredConfig(config, requiredKeys) {
  const result = {
    valid: true,
    missingKeys: [],
    errors: []
  };

  for (const keyPath of requiredKeys) {
    const keys = keyPath.split('.');
    let value = config;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        value = undefined;
        break;
      }
    }

    if (value === undefined || value === null || value === '') {
      result.valid = false;
      result.missingKeys.push(keyPath);
      result.errors.push(`Missing required configuration: ${keyPath}`);
    }
  }

  return result;
}

/**
 * Create a safe timeout that won't exceed Node.js max timeout
 * @param {Function} callback - Function to call after timeout
 * @param {number} ms - Milliseconds to wait
 * @returns {NodeJS.Timeout} - Timeout handle
 */
function safeSetTimeout(callback, ms) {
  const MAX_TIMEOUT = 2147483647; 
  const safeMs = Math.min(ms, MAX_TIMEOUT);
  return setTimeout(callback, safeMs);
}

module.exports = {
  sanitizeErrorMessage,
  checkRateLimit,
  cleanupRateLimits,
  verifyPermissionLevel,
  escapeMarkdown,
  generateErrorId,
  validateRequiredConfig,
  safeSetTimeout
};
