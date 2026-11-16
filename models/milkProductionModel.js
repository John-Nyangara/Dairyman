const db = require("../config/db");

/**
 * Fetch aggregated daily milk production records per animal for a farmer.
 * @param {number} farmerId
 * @returns {Promise<Array>}
 */
async function getDailyTotalsByFarmerId(farmerId) {
  return db.query(
    `SELECT
       Animal.animal_tag,
       Animal.name AS animal_name,
       MilkProduction.production_date,
       SUM(MilkProduction.quantity) AS total_daily_production,
       COUNT(*) AS milking_sessions,
       Farmers.farm_name,
       MilkProduction.unit
     FROM MilkProduction
     JOIN Animal ON MilkProduction.animal_id = Animal.animal_tag
     JOIN Farmers ON Animal.owner_id = Farmers.farmer_id
     WHERE Farmers.farmer_id = ?
     GROUP BY Animal.animal_tag, Animal.name, MilkProduction.production_date, Farmers.farm_name, MilkProduction.unit
     ORDER BY MilkProduction.production_date DESC, total_daily_production DESC`,
    [farmerId]
  );
}

/**
 * Fetch total milk production per animal for a farmer.
 * @param {number} farmerId
 * @returns {Promise<Array>}
 */
async function getAnimalTotalsByFarmerId(farmerId) {
  return db.query(
    `SELECT
       f.farm_name,
       f.fullname AS farmer_name,
       a.animal_tag,
       a.name AS animal_name,
       SUM(mp.quantity) AS total_production,
       mp.unit
     FROM Farmers f
     JOIN Animal a ON f.farmer_id = a.owner_id
     JOIN MilkProduction mp ON a.animal_tag = mp.animal_id
     WHERE f.farmer_id = ?
     GROUP BY f.farm_name, f.fullname, a.animal_tag, a.name, mp.unit`,
    [farmerId]
  );
}

/**
 * Fetch the most recent milk production records for a farmer.
 * @param {number} farmerId
 * @param {number} [limit=30]
 * @returns {Promise<Array>}
 */
async function getRecentByFarmerId(farmerId, limit = 30) {
  return db.query(
    `SELECT
       Animal.animal_tag,
       Animal.name AS animal_name,
       MilkProduction.production_date,
       MilkProduction.production_time,
       MilkProduction.quantity
     FROM MilkProduction
     JOIN Animal ON MilkProduction.animal_id = Animal.animal_tag
     JOIN Farmers ON Animal.owner_id = Farmers.farmer_id
     WHERE Farmers.farmer_id = ?
     ORDER BY MilkProduction.production_date DESC, MilkProduction.production_time DESC
     LIMIT ?`,
    [farmerId, limit]
  );
}

/**
 * Insert a new milk production record.
 * @param {object} productionData
 * @returns {Promise<any>}
 */
async function create({
  animal_id,
  production_date,
  production_time,
  quantity,
  quality,
}) {
  return db.query(
    `INSERT INTO MilkProduction (animal_id, production_date, production_time, quantity, quality)
     VALUES (?, ?, ?, ?, ?)`,
    [
      animal_id,
      production_date,
      production_time,
      Number(quantity),
      quality && quality.trim().length > 0 ? quality.trim() : "High",
    ]
  );
}

module.exports = {
  getDailyTotalsByFarmerId,
  getAnimalTotalsByFarmerId,
  getRecentByFarmerId,
  create,
};

