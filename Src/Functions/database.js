const { PrismaClient } = require('@prisma/client');
const { getTableSchemas } = require('./tableSchemas');
const config = require('../../config');
const { isValidTableName, isValidColumnName } = require('./validation');
const { sanitizeErrorMessage } = require('./security-utils');

class DatabaseManager {
  constructor() {
    this.prisma = null;
    this.isAvailable = false;
    this.tableSchemas = getTableSchemas();
    this.initialized = false;
    this.waitLogPrinted = false;

    const pgConfig = config.get('server.postgres', {});

    // Validate critical configuration
    if (!pgConfig.host || !pgConfig.database || !pgConfig.user) {
      console.warn('⚠️ Database configuration incomplete. Some features may not work.');
    }
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      this.prisma = new PrismaClient({
        log: process.env.DB_DEBUG === 'true' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
        datasources: {
          db: {
            url: this._buildConnectionString()
          }
        }
      });

      // Test connection
      await this.prisma.$connect();
      this.isAvailable = true;
      console.log('✅ PostgreSQL connected (Prisma)');

      // Warm up tables
      const tables = Object.keys(this.tableSchemas);
      const warmupResults = await Promise.allSettled(
        tables.map(async (table) => {
          try {
            await this.prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
            return { table, ok: true };
          } catch (error) {
            return { table, ok: false, error: error.message };
          }
        })
      );

      const failed = warmupResults.filter(
        (r) => r.status === 'fulfilled' && r.value && !r.value.ok
      );
      if (failed.length > 0) {
        console.warn(
          `⚠️ Table warmup: ${failed.length}/${tables.length} failed.`
        );
        failed.forEach((f) =>
          console.warn(` - ${f.value.table}: ${f.value.error}`)
        );
      }

      this.initialized = true;
    } catch (error) {
      const safeMessage = sanitizeErrorMessage(error, process.env.NODE_ENV !== 'production');
      console.error('❌ PostgreSQL connection failed:', safeMessage);

      if (process.env.NODE_ENV !== 'production') {
        console.error('Full error details:', error);
      }

      this.isAvailable = false;
      throw new Error(`Database connection failed: ${safeMessage}`);
    }
  }

  /**
   * Build Prisma connection string from config
   */
  _buildConnectionString() {
    const pgConfig = config.get('server.postgres', {});
    const user = pgConfig.user;
    const password = pgConfig.password || '';
    const host = pgConfig.host;
    const port = pgConfig.port || 5432;
    const database = pgConfig.database;

    let sslParam = '';
    if (pgConfig.ssl === true || process.env.SERVER_POSTGRES_SSL === 'true') {
      sslParam = '?sslmode=require';
    } else if (pgConfig.noVerifySSL || process.env.SERVER_POSTGRES_NOVERIFYSSL === 'true') {
      sslParam = '?sslmode=require&sslaccept=accept_invalid_certs';
    }

    return `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
  }

  /**
   * Wait for PostgreSQL
   */
  async waitForPostgres(timeoutMs = 10000) {
    if (this.isAvailable) {
      return;
    }
    const interval = 500;
    const start = Date.now();

    if (!this.waitLogPrinted) {
      console.log('⏳ Waiting for PostgreSQL connection...');
      this.waitLogPrinted = true;
    }

    while (!this.isAvailable) {
      if (Date.now() - start >= timeoutMs) {
        throw new Error(
          `⌛ Timed out waiting for PostgreSQL after ${timeoutMs}ms`
        );
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    if (this.waitLogPrinted) {
      console.log('✅ PostgreSQL is now available');
      this.waitLogPrinted = false;
    }
  }

  /**
   * Raw query (Prisma equivalent)
   */
  async rawQuery(text, params = []) {
    await this.waitForPostgres();

    if (!this.prisma) {
      throw new Error('Prisma not initialized');
    }

    try {
      const start = Date.now();
      const safeQuery = String(text).substring(0, 200);

      // Prisma uses $1, $2 style parameters like pg
      const result = await this.prisma.$queryRawUnsafe(text, ...params);
      const duration = Date.now() - start;

      if (duration > 5000) {
        console.warn(`[DB] Slow query (${duration}ms): ${safeQuery}...`);
      }

      if (process.env.DB_DEBUG === 'true') {
        console.log(`[DB] Query (${duration}ms): ${safeQuery}`);
      }

      // Convert Prisma result to pg-like format
      return {
        rows: Array.isArray(result) ? result : [],
        rowCount: Array.isArray(result) ? result.length : 0
      };
    } catch (error) {
      const safeErr = sanitizeErrorMessage(error, process.env.NODE_ENV !== 'production');
      console.error(`❌ Query failed: ${String(text).substring(0, 120)}`, safeErr);
      throw new Error(`Database query failed: ${safeErr}`);
    }
  }

  /**
   * loadDb
   */
  async loadDb({
    table,
    id = null,
    where = null,
    primaryKey = null,
    caseInsensitive = false,
    limit = null,
    offset = 0,
    columns = null,
    sortBy = null,
    sortOrder = 'ASC',
    returnCount = false
  } = {}) {
    await this.waitForPostgres();

    if (!isValidTableName(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }

    const schema = this.tableSchemas[table];
    if (!schema) {
      throw new Error(`Schema missing: ${table}`);
    }

    const pk = primaryKey || schema.primaryKeys;
    const { conds, vals } = this._buildConditions({
      id,
      where,
      pk,
      ci: caseInsensitive
    });

    const whereSQL = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    if (columns) {
      for (const col of columns) {
        if (!isValidColumnName(col)) {
          throw new Error(`Invalid column name: ${col}`);
        }
      }
    }
    const colsSQL = columns ? columns.map((c) => `"${c}"`).join(',') : '*';

    let sql = `SELECT ${colsSQL} FROM "${table}" ${whereSQL}`;

    if (sortBy) {
      if (!isValidColumnName(sortBy)) {
        throw new Error(`Invalid sort column: ${sortBy}`);
      }
      const o = String(sortOrder).toUpperCase();
      if (o !== 'ASC' && o !== 'DESC') {
        throw new Error(`Invalid sort order: ${sortOrder}`);
      }
      sql += ` ORDER BY "${sortBy}" ${o}`;
    }

    if (id !== null) {
      sql += ' LIMIT 1';
    } else {
      sql += ` LIMIT ${limit || 'ALL'} OFFSET ${offset}`;
    }

    const res = await this.rawQuery(sql, vals);

    if (id !== null) {
      return res.rows[0] || null;
    }
    if (!returnCount) {
      return res.rows;
    }

    const countRes = await this.rawQuery(
      `SELECT COUNT(*) FROM "${table}" ${whereSQL}`,
      vals
    );
    return {
      data: res.rows,
      count: +countRes.rows[0].count
    };
  }

  /**
   * saveDb
   */
  async saveDb(items, { table } = {}) {
    await this.waitForPostgres();

    if (!table) {
      throw new Error('Table required');
    }

    if (!isValidTableName(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }

    const arr = Array.isArray(items) ? items : [items];
    if (!arr.length) {
      return;
    }

    const { columns: cols, primaryKeys } = this.tableSchemas[table];
    if (!cols) {
      throw new Error(`Schema missing: ${table}`);
    }

    const useCols = [
      ...new Set(
        arr.flatMap((it) => Object.keys(it).filter((c) => cols.includes(c)))
      )
    ];
    if (!useCols.length) {
      return;
    }

    const conflict = primaryKeys.map((k) => `"${k}"`).join(',');
    const updates = useCols.filter((c) => !primaryKeys.includes(c));

    // Stringify objects/arrays
    arr.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (Array.isArray(item[key]) || typeof item[key] === 'object') {
          item[key] = JSON.stringify(item[key]);
        }
      });
    });

    // Batch insert 500 at a time
    for (let i = 0; i < arr.length; i += 500) {
      const batch = arr.slice(i, i + 500);
      const ph = batch
        .map(
          (_, bi) =>
            `(${useCols
              .map((_, ci) => `$${bi * useCols.length + ci + 1}`)
              .join(',')})`
        )
        .join(',');

      const vals = batch.flatMap((row) => useCols.map((c) => row[c] ?? null));

      let sql = `INSERT INTO "${table}" (${useCols
        .map((c) => `"${c}"`)
        .join(',')}) VALUES ${ph}`;

      if (updates.length) {
        sql += ` ON CONFLICT (${conflict}) DO UPDATE SET ${updates
          .map((c) => `"${c}"=EXCLUDED."${c}"`)
          .join(',')}`;
      }

      await this.rawQuery(sql, vals);
    }
  }

  /**
   * updateDb
   */
  async updateDb(item, { table } = {}) {
    await this.waitForPostgres();

    if (!table) {
      throw new Error('Table required');
    }

    if (!isValidTableName(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }

    const { columns: cols, primaryKeys } = this.tableSchemas[table];
    const pkArr = Array.isArray(primaryKeys) ? primaryKeys : [primaryKeys];

    for (const k of pkArr) {
      if (item[k] === null) {
        throw new Error(
          `Missing primary key '${k}' for updateDb on table ${table}`
        );
      }
    }

    const setCols = Object.keys(item).filter(
      (c) => cols.includes(c) && !pkArr.includes(c)
    );
    if (setCols.length === 0) {
      return 0;
    }

    const setClauses = setCols.map((c, i) => `"${c}" = $${i + 1}`).join(', ');
    const setVals = setCols.map((c) =>
      typeof item[c] === 'object' && item[c] !== null
        ? JSON.stringify(item[c])
        : item[c]
    );

    const whereClauses = pkArr
      .map((k, i) => `"${k}" = $${setCols.length + i + 1}`)
      .join(' AND ');
    const whereVals = pkArr.map((k) => item[k]);

    const sql = `UPDATE "${table}" SET ${setClauses} WHERE ${whereClauses}`;
    const res = await this.rawQuery(sql, [...setVals, ...whereVals]);

    return res.rowCount || 0;
  }

  /**
   * deleteDb
   */
  async deleteDb({ table, where }) {
    await this.waitForPostgres();

    if (!table || !where) {
      throw new Error('Table and where required');
    }

    if (!isValidTableName(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }

    const schema = this.tableSchemas[table];
    const { conds, vals } = this._buildConditions({
      id: null,
      where,
      pk: schema.primaryKeys,
      ci: false
    });

    if (!conds.length) {
      throw new Error('Refusing to delete without conditions');
    }

    const res = await this.rawQuery(
      `DELETE FROM "${table}" WHERE ${conds.join(' AND ')}`,
      vals
    );
    return res.rowCount;
  }

  /**
   * ensurePostgresTables
   */
  async ensurePostgresTables() {
    await this.waitForPostgres();
    console.log('🔧 Ensuring table schemas are up to date...');

    try {
      const schemas = this.tableSchemas;
      const names = Object.keys(schemas);

      const result = await this.prisma.$queryRawUnsafe(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ANY($1)`,
        names
      );

      const colsMap = result.reduce((map, { table_name, column_name }) => {
        map[table_name] = map[table_name] || new Set();
        map[table_name].add(column_name);
        return map;
      }, {});

      let created = 0;
      let addedColsTotal = 0;

      for (const table of names) {
        const { createSQL, columns: definedColumns } = schemas[table];

        const existsResult = await this.prisma.$queryRawUnsafe(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
          )`,
          table
        );
        const tableExists = existsResult[0].exists;

        if (!tableExists) {
          created++;
          console.log(`➡️ Creating table: ${table}`);
          await this.prisma.$executeRawUnsafe(createSQL);
          continue;
        }

        const existingColumns = colsMap[table] || new Set();
        const missingColumns = definedColumns.filter(
          (col) => !existingColumns.has(col)
        );

        if (missingColumns.length > 0) {
          addedColsTotal += missingColumns.length;
          console.log(
            `➕ Adding ${
              missingColumns.length
            } columns to ${table}: ${missingColumns.join(', ')}`
          );

          for (const column of missingColumns) {
            try {
              const columnDefMatch = createSQL.match(
                new RegExp(`"${column}"\\s+([^,]+)`)
              );
              const columnDef = columnDefMatch ? columnDefMatch[1] : 'TEXT';
              await this.prisma.$executeRawUnsafe(
                `ALTER TABLE "${table}" ADD COLUMN "${column}" ${columnDef}`
              );
            } catch (error) {
              console.error(
                `❌ Failed to add column ${table}.${column}:`,
                error.message || error
              );
            }
          }
        }
      }

      console.log(
        `🔧 Schema check: created ${created} tables, added ${addedColsTotal} columns`
      );
    } catch (error) {
      console.error('❌ Schema verification failed:', error);
      throw error;
    }
  }

  /**
   * getNextId - Get the next available ID for a table
   */
  async getNextId({ table } = {}) {
    await this.waitForPostgres();

    if (!table) {
      throw new Error('Table required');
    }

    if (!isValidTableName(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }

    const schemas = this.tableSchemas;
    if (!schemas[table]) {
      throw new Error(`Unsupported table: ${table}`);
    }

    const primaryKeys = schemas[table].primaryKeys;
    if (!primaryKeys) {
      throw new Error(`Primary keys not defined for table: ${table}`);
    }

    const pk = primaryKeys;
    const pkColumn = Array.isArray(pk) ? pk[0] : pk;

    if (!isValidColumnName(pkColumn)) {
      throw new Error(`Invalid primary key column name: ${pkColumn}`);
    }

    const res = await this.prisma.$queryRawUnsafe(
      `SELECT MAX("${pkColumn}") AS max_id FROM "${table}"`
    );
    return (res[0].max_id || 0) + 1;
  }

  /**
   * getNextTypeId
   */
  async getNextTypeId(baseType) {
    try {
      const query = `
        SELECT MAX((type_id->>$1)::int) AS max_id
        FROM hosts
        WHERE type_id ? $1
      `;

      const res = await this.rawQuery(query, [baseType]);
      return (res.rows[0].max_id || 0) + 1;
    } catch (error) {
      console.error(`Error getting next type ID for ${baseType}:`, error);
      const hosts = await this.loadDb({ table: 'hosts' });
      let maxId = 0;

      for (const host of hosts) {
        try {
          const typeIds =
            typeof host.type_id === 'string'
              ? JSON.parse(host.type_id)
              : host.type_id;
          if (typeIds && typeIds[baseType] && typeIds[baseType] > maxId) {
            maxId = typeIds[baseType];
          }
        } catch (e) {
          console.error('Error parsing type_id:', e);
        }
      }

      return maxId + 1;
    }
  }

  /**
   * closePool
   */
  async closePool() {
    if (this.prisma) {
      console.log('🛑 Closing Prisma connection...');
      await this.prisma.$disconnect();
      this.prisma = null;
      this.isAvailable = false;
      this.initialized = false;
      console.log('✅ Prisma connection closed');
    }
  }

  /**
   * isReady
   */
  isReady() {
    return this.isAvailable;
  }

  /**
   * Internal helper: buildConditions
   */
  _buildConditions({ id, where, pk, ci }) {
    const conds = [];
    const vals = [];
    let idx = 1;

    const addCondition = (col, val) => {
      if (val && typeof val === 'object' && val.$like) {
        const term = `%${val.$like.replace(/%/g, '')}%`;
        vals.push(term);
        return ci
          ? `LOWER("${col}") LIKE LOWER($${idx++})`
          : `"${col}" LIKE $${idx++}`;
      }

      if (val && typeof val === 'object') {
        return Object.entries(val)
          .filter(([op]) => ['$lt', '$lte', '$gt', '$gte'].includes(op))
          .map(([op, v]) => {
            const map = { $lt: '<', $lte: '<=', $gt: '>', $gte: '>=' };
            vals.push(v);
            return `"${col}" ${map[op]} $${idx++}`;
          })
          .join(' AND ');
      }

      if (ci && typeof val === 'string') {
        vals.push(val);
        return `LOWER("${col}") = LOWER($${idx++})`;
      }

      vals.push(val);
      return `"${col}" = $${idx++}`;
    };

    if (id !== null) {
      if (Array.isArray(pk)) {
        pk.forEach((k) => {
          vals.push(id[k]);
          conds.push(`"${k}" = $${idx++}`);
        });
      } else {
        vals.push(id);
        conds.push(`"${pk}" = $${idx++}`);
      }
    }

    if (where) {
      if (Array.isArray(where.$or)) {
        const orGroups = where.$or
          .map((group) => {
            const parts = Object.entries(group)
              .map(([c, v]) => addCondition(c, v))
              .filter(Boolean);
            if (parts.length === 0) {
              return null;
            }
            return `(${parts.join(' AND ')})`;
          })
          .filter(Boolean);

        const otherClauses = Object.entries(where)
          .filter(([k]) => k !== '$or')
          .map(([c, v]) => addCondition(c, v))
          .filter(Boolean);

        const combined = [
          ...otherClauses,
          ...(orGroups.length ? [orGroups.join(' OR ')] : [])
        ];

        if (combined.length) {
          conds.push(`(${combined.join(' AND ')})`);
        }
      } else {
        const clauses = Object.entries(where)
          .map(([c, v]) => addCondition(c, v))
          .filter(Boolean);
        if (clauses.length) {
          const joiner = Array.isArray(where.$or) ? ' OR ' : ' AND ';
          conds.push(`(${clauses.join(joiner)})`);
        }
      }
    }

    return { conds, vals };
  }
}

// Create singleton instance
const db = new DatabaseManager();

// Auto-initialize
if (process.env.DB_AUTO_INIT !== 'false') {
  db.initialize().catch(console.error);
}

// Graceful shutdown
process.on('SIGTERM', () => db.closePool());
process.on('SIGINT', () => db.closePool());

module.exports = {
  rawQuery: (...args) => db.rawQuery(...args),
  loadDb: (options) => db.loadDb(options),
  saveDb: (items, options) => db.saveDb(items, options),
  updateDb: (item, options) => db.updateDb(item, options),
  deleteDb: (options) => db.deleteDb(options),
  ensurePostgresTables: () => db.ensurePostgresTables(),
  getNextId: (options) => db.getNextId(options),
  getNextTypeId: (baseType) => db.getNextTypeId(baseType),
  closePool: () => db.closePool(),
  isReady: () => db.isReady(),

  buildConditions: (...args) => db._buildConditions(...args),
  instance: db
};
