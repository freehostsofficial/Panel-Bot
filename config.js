const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
require('dotenv').config();

const SETTINGS_DIR = path.join(__dirname, 'Src', 'Settings');
const emitter = new EventEmitter();

// Critical configuration keys that must be present in production
const CRITICAL_KEYS = [
  'settings.bot.token',
  'settings.bot.clientid'
];

const PRODUCTION = process.env.NODE_ENV === 'production';

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function findKeyCaseInsensitive(obj, key) {
  if (!obj || typeof obj !== 'object') return key;
  const lower = String(key).toLowerCase();
  const found = Object.keys(obj).find(k => k.toLowerCase() === lower);
  return found || key;
}

function getNestedCaseInsensitive(obj, parts) {
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    const key = findKeyCaseInsensitive(cur, p);
    cur = cur[key];
  }
  return cur;
}

function parseValue(str, preserve) {
  if (typeof str !== 'string') return str;
  const v = str.trim();
  if (preserve) return v;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  if (/^[\[{]/.test(v)) {
    try { return JSON.parse(v); } catch {}
  }
  return v;
}

function setNested(obj, parts, value) {
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    const forceArray = raw.endsWith('[]');
    const clean = raw.replace(/\[\]$/, '');
    const key = findKeyCaseInsensitive(cur, clean);

    if (i === parts.length - 1) {
      const preserve = /(id|token|url|channelid|webhookid|webhooktoken)$/i.test(clean);
      let parsed;

      if (forceArray) {
        parsed = value.trim().startsWith('[')
          ? (() => { try { return JSON.parse(value); } catch { return []; } })()
          : value.split(',').map(v => parseValue(v, preserve));
      } else {
        parsed = parseValue(value, preserve);
      }

      cur[key] = parsed;
      return;
    }

    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
}

function applyEnv(json, name) {
  const up = name.toUpperCase();
  for (const [k, v] of Object.entries(process.env)) {
    if (!v || !k.startsWith(up)) continue;
    const parts = k.split(/[-_]/);
    parts.shift();
    if (parts.length) setNested(json, parts, v);
  }
}

function loadConfigFile(name) {
  const filePath = path.join(SETTINGS_DIR, `${name}.json`);
  const json = safeReadJson(filePath);
  applyEnv(json, name);
  return { data: json, filePath };
}

const cache = new Map();
const watchers = new Map();

function watch(filePath, name) {
  if (watchers.has(filePath)) return;
  try {
    const w = fs.watch(filePath, { persistent: false }, () => {
      const { data } = loadConfigFile(name);
      cache.set(name, data);
      emitter.emit('reload', name, data);
    });
    watchers.set(filePath, w);
  } catch {}
}

function loadAll(names) {
  for (const name of names) {
    const { data, filePath } = loadConfigFile(name);
    cache.set(name, data);
    if (process.env.NODE_ENV !== 'production' && fs.existsSync(filePath)) {
      watch(filePath, name);
    }
  }
}

function get(pathStr, def) {
  const parts = String(pathStr).split('.');
  const root = parts.shift();
  const base = cache.get(root);
  if (parts.length === 0) return base ?? def;
  const val = getNestedCaseInsensitive(base, parts);
  return val ?? def;
}

/**
 * Validate that critical configuration values are present
 * In production, this will throw an error if critical values are missing
 */
function validateCriticalConfig() {
  const missing = [];
  const warnings = [];
  
  for (const key of CRITICAL_KEYS) {
    const value = get(key);
    
    if (value === undefined || value === null || value === '') {
      missing.push(key);
    } else if (typeof value === 'string' && (
      value === 'your_bot_token_here' ||
      value === 'your_client_id_here' ||
      value === 'CONFIGURE_IN_ENV_FILE'
    )) {
      warnings.push(`${key} appears to be a placeholder value`);
    }
  }
  
  if (missing.length > 0) {
    const errorMsg = `\n❌ CRITICAL CONFIGURATION ERROR:\n` +
      `Missing required configuration values:\n` +
      missing.map(k => `  - ${k}`).join('\n') + '\n\n' +
      `Please check your .env file or environment variables.\n` +
      `See .env.example for required configuration.\n`;
    
    if (PRODUCTION) {
      // Fail-fast in production
      console.error(errorMsg);
      process.exit(1);
    } else {
      // Warn in development
      console.warn(errorMsg);
    }
  }
  
  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
    console.warn('');
  }
  
  return { valid: missing.length === 0, missing, warnings };
}

function reload(name) {
  if (!name) return loadAll(DEFAULTS);
  const { data } = loadConfigFile(name);
  cache.set(name, data);
  emitter.emit('reload', name, data);
}

const DEFAULTS = ['settings', 'embed', 'server', 'logs', 'api'];
loadAll(DEFAULTS);

// Validate configuration on load (with small delay to ensure env vars are loaded)
setTimeout(() => {
  const validation = validateCriticalConfig();
  if (validation.valid) {
    console.log('✅ Configuration validated successfully');
  }
}, 100);

module.exports = {
  get,
  reload,
  validateCriticalConfig,
  on: emitter.on.bind(emitter)
};
