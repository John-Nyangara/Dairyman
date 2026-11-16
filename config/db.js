const fs = require("fs");
const path = require("path");
const mysql = require("mysql2");

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "dairyman",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "SereneArcadian5050##",
  port: Number(process.env.DB_PORT) || 3306,
  connectionLimit: 10,
  decimalNumbers: true,
};

const pool = mysql.createPool(dbConfig);

let initPromise = null;

/**
 * Create and seed the database from db.sql when it does not exist yet.
 * @returns {Promise<void>}
 */
function runSchemaScript() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve, reject) => {
    const sqlPath = path.join(__dirname, "..", "db.sql");
    const sqlScript = fs.readFileSync(sqlPath, "utf8");

    const bootstrapConn = mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port,
      multipleStatements: true,
    });

    bootstrapConn.query(sqlScript, (err) => {
      bootstrapConn.end();
      initPromise = null;
      if (err) {
        return reject(err);
      }
      console.log(`Database '${dbConfig.database}' created and seeded from db.sql.`);
      resolve();
    });
  });

  return initPromise;
}

/**
 * Execute a raw query against the connection pool without auto-init retry.
 * @param {string} sql
 * @param {Array} [params=[]]
 * @returns {Promise<any>}
 */
function rawQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
}

/**
 * Execute a parameterized SQL query against the MySQL connection pool.
 * Automatically initializes the database from db.sql if the database or tables do not exist yet.
 * @param {string} sql
 * @param {Array} [params=[]]
 * @returns {Promise<any>}
 */
async function query(sql, params = []) {
  try {
    return await rawQuery(sql, params);
  } catch (err) {
    if (
      err &&
      (err.code === "ER_BAD_DB_ERROR" || err.code === "ER_NO_SUCH_TABLE")
    ) {
      await runSchemaScript();
      return rawQuery(sql, params);
    }
    throw err;
  }
}

/**
 * Ensure the database and tables exist on server startup.
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  try {
    await rawQuery("SELECT 1 FROM Farmers LIMIT 1");
  } catch (err) {
    if (
      err &&
      (err.code === "ER_BAD_DB_ERROR" || err.code === "ER_NO_SUCH_TABLE")
    ) {
      await runSchemaScript();
      return;
    }
    throw err;
  }
}

module.exports = {
  pool,
  query,
  initializeDatabase,
};
