const bcrypt = require("bcrypt");
const db = require("../config/db");

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

/**
 * Normalize an email address for consistent storage and lookup.
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/**
 * Hash a plaintext password using bcrypt with a per-user salt.
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 * @param {string} plainPassword
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainPassword, hashedPassword) {
  if (
    typeof plainPassword !== "string" ||
    typeof hashedPassword !== "string" ||
    plainPassword.length === 0 ||
    hashedPassword.length === 0
  ) {
    return false;
  }
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Find a farmer by email (case-insensitive).
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const rows = await db.query(
    `SELECT farmer_id, fullname, phone, email, password, county, farm_location, farm_name
     FROM Farmers
     WHERE LOWER(email) = ?
     LIMIT 1`,
    [normalized]
  );

  return rows[0] || null;
}

/**
 * Create a new farmer record with a bcrypt-hashed password.
 * @param {object} farmerData
 * @returns {Promise<number>} Inserted farmer_id
 */
async function create({
  fullname,
  phone,
  email,
  password,
  county,
  farm_location,
  farm_name,
}) {
  const normalizedEmail = normalizeEmail(email);
  const hashedPassword = await hashPassword(password);

  const result = await db.query(
    `INSERT INTO Farmers (fullname, phone, email, password, county, farm_location, farm_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fullname.trim(),
      phone ? phone.trim() : null,
      normalizedEmail,
      hashedPassword,
      county ? county.trim() : null,
      farm_location ? farm_location.trim() : null,
      farm_name ? farm_name.trim() : null,
    ]
  );

  return result.insertId;
}

/**
 * Strip sensitive fields before storing a farmer in the session.
 * @param {object} farmer
 * @returns {object}
 */
function toSafeSessionUser(farmer) {
  return {
    farmer_id: farmer.farmer_id,
    email: farmer.email,
    fullname: farmer.fullname,
    farm_name: farmer.farm_name || null,
  };
}

module.exports = {
  SALT_ROUNDS,
  normalizeEmail,
  hashPassword,
  verifyPassword,
  findByEmail,
  create,
  toSafeSessionUser,
};

