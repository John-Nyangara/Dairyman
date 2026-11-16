const db = require("../config/db");

/**
 * Fetch all animals belonging to a farmer.
 * @param {number} farmerId
 * @returns {Promise<Array>}
 */
async function findByFarmerId(farmerId) {
  return db.query(
    `SELECT * FROM Animal WHERE owner_id = ?`,
    [farmerId]
  );
}

/**
 * Fetch alive female animals eligible for milking belonging to a farmer.
 * @param {number} farmerId
 * @returns {Promise<Array>}
 */
async function findMilkingAnimalsByFarmerId(farmerId) {
  return db.query(
    `SELECT animal_tag, name
     FROM Animal
     WHERE owner_id = ? AND status = 'Alive' AND gender = 'Female'`,
    [farmerId]
  );
}

/**
 * Verify an animal belongs to a specific farmer.
 * @param {string} animalTag
 * @param {number} farmerId
 * @returns {Promise<object|null>}
 */
async function findByTagAndFarmerId(animalTag, farmerId) {
  const rows = await db.query(
    `SELECT animal_tag, name, owner_id
     FROM Animal
     WHERE animal_tag = ? AND owner_id = ?
     LIMIT 1`,
    [animalTag, farmerId]
  );
  return rows[0] || null;
}

/**
 * Register a new animal for a farmer.
 * @param {object} animalData
 * @returns {Promise<any>}
 */
async function create({
  animal_tag,
  name,
  dob,
  purchase_date,
  breed,
  status,
  source,
  gender,
  owner_id,
  imagename,
}) {
  const sql = `INSERT INTO Animal (animal_tag, name, dob, purchase_date, breed, status, source, gender, owner_id, imagename)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    animal_tag.trim(),
    name.trim(),
    dob,
    purchase_date && purchase_date.trim().length > 0 ? purchase_date : null,
    breed ? breed.trim() : null,
    status,
    source,
    gender,
    owner_id,
    imagename || "",
  ];

  try {
    return await db.query(sql, params);
  } catch (err) {
    if (err && err.code === "ER_BAD_FIELD_ERROR") {
      await db.query(
        `ALTER TABLE Animal ADD COLUMN imagename VARCHAR(255) NULL`
      );
      return db.query(sql, params);
    }
    throw err;
  }
}

module.exports = {
  findByFarmerId,
  findMilkingAnimalsByFarmerId,
  findByTagAndFarmerId,
  create,
};

