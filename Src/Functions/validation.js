/**
 * Input Validation Utilities
 * Provides sanitization and validation for user inputs to prevent injection attacks
 */

/**
 * Sanitize a string for safe SQL usage
 * Removes or escapes potentially dangerous characters
 * @param {string} input - The input string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeSQLString(input) {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Escape single quotes
  sanitized = sanitized.replace(/'/g, "''");

  return sanitized;
}

/**
 * Validate a table name to prevent SQL injection
 * Only allows alphanumeric characters and underscores
 * @param {string} tableName - The table name to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidTableName(tableName) {
  if (typeof tableName !== 'string') {
    return false;
  }

  // Only allow alphanumeric and underscores, 1-64 characters
  return /^[a-zA-Z0-9_]{1,64}$/.test(tableName);
}

/**
 * Validate a column name to prevent SQL injection
 * Only allows alphanumeric characters and underscores
 * @param {string} columnName - The column name to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidColumnName(columnName) {
  if (typeof columnName !== 'string') {
    return false;
  }

  // Only allow alphanumeric and underscores, 1-64 characters
  return /^[a-zA-Z0-9_]{1,64}$/.test(columnName);
}

/**
 * Validate a Discord snowflake ID
 * @param {string|number} id - The Discord ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidDiscordId(id) {
  const idStr = String(id);

  // Discord snowflakes are 17-19 digits
  return /^\d{17,19}$/.test(idStr);
}

/**
 * Validate and sanitize a string input
 * @param {string} input - The input to validate
 * @param {object} options - Validation options
 * @param {number} options.minLength - Minimum length (default: 0)
 * @param {number} options.maxLength - Maximum length (default: 1000)
 * @param {boolean} options.allowEmpty - Allow empty strings (default: false)
 * @param {RegExp} options.pattern - Custom regex pattern to match
 * @returns {object} - { valid: boolean, sanitized: string, error: string }
 */
function validateString(input, options = {}) {
  const {
    minLength = 0,
    maxLength = 1000,
    allowEmpty = false,
    pattern = null
  } = options;

  const result = {
    valid: false,
    sanitized: '',
    error: null
  };

  // Type check
  if (typeof input !== 'string') {
    result.error = 'Input must be a string';
    return result;
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Check empty
  if (!allowEmpty && trimmed.length === 0) {
    result.error = 'Input cannot be empty';
    return result;
  }

  // Check length
  if (trimmed.length < minLength) {
    result.error = `Input must be at least ${minLength} characters`;
    return result;
  }

  if (trimmed.length > maxLength) {
    result.error = `Input must be at most ${maxLength} characters`;
    return result;
  }

  // Check pattern
  if (pattern && !pattern.test(trimmed)) {
    result.error = 'Input does not match required format';
    return result;
  }

  result.valid = true;
  result.sanitized = trimmed;
  return result;
}

/**
 * Validate a number input
 * @param {any} input - The input to validate
 * @param {object} options - Validation options
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @param {boolean} options.integer - Must be an integer (default: false)
 * @returns {object} - { valid: boolean, value: number, error: string }
 */
function validateNumber(input, options = {}) {
  const {
    min = -Infinity,
    max = Infinity,
    integer = false
  } = options;

  const result = {
    valid: false,
    value: null,
    error: null
  };

  // Try to convert to number
  const num = Number(input);

  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    result.error = 'Input must be a valid number';
    return result;
  }

  // Check integer requirement
  if (integer && !Number.isInteger(num)) {
    result.error = 'Input must be an integer';
    return result;
  }

  // Check range
  if (num < min) {
    result.error = `Input must be at least ${min}`;
    return result;
  }

  if (num > max) {
    result.error = `Input must be at most ${max}`;
    return result;
  }

  result.valid = true;
  result.value = num;
  return result;
}

/**
 * Validate a URL
 * @param {string} input - The URL to validate
 * @param {object} options - Validation options
 * @param {string[]} options.allowedProtocols - Allowed protocols (default: ['http:', 'https:'])
 * @returns {object} - { valid: boolean, url: URL|null, error: string }
 */
function validateURL(input, options = {}) {
  const { allowedProtocols = ['http:', 'https:'] } = options;

  const result = {
    valid: false,
    url: null,
    error: null
  };

  if (typeof input !== 'string') {
    result.error = 'URL must be a string';
    return result;
  }

  try {
    const url = new URL(input);

    if (!allowedProtocols.includes(url.protocol)) {
      result.error = `Protocol must be one of: ${allowedProtocols.join(', ')}`;
      return result;
    }

    result.valid = true;
    result.url = url;
    return result;
  } catch (error) {
    result.error = 'Invalid URL format';
    return result;
  }
}

/**
 * Sanitize a filename to prevent directory traversal
 * @param {string} filename - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') {
    return 'file';
  }

  // Remove directory traversal attempts
  let safe = filename.replace(/\.\./g, '');

  // Remove path separators
  safe = safe.replace(/[\/\\]/g, '');

  // Remove null bytes
  safe = safe.replace(/\0/g, '');

  // Only allow safe characters
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length
  if (safe.length > 255) {
    safe = safe.substring(0, 255);
  }

  return safe || 'file';
}

/**
 * Validate an array of Discord IDs
 * @param {any} input - The input to validate (should be array of IDs)
 * @returns {object} - { valid: boolean, ids: string[], error: string }
 */
function validateDiscordIds(input) {
  const result = {
    valid: false,
    ids: [],
    error: null
  };

  if (!Array.isArray(input)) {
    result.error = 'Input must be an array';
    return result;
  }

  const validIds = [];
  for (const id of input) {
    if (!isValidDiscordId(id)) {
      result.error = `Invalid Discord ID: ${id}`;
      return result;
    }
    validIds.push(String(id));
  }

  result.valid = true;
  result.ids = validIds;
  return result;
}

module.exports = {
  sanitizeSQLString,
  isValidTableName,
  isValidColumnName,
  isValidDiscordId,
  validateString,
  validateNumber,
  validateURL,
  sanitizeFilename,
  validateDiscordIds
};
