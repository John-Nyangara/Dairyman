const AnimalModel = require("../models/animalModel");
const MilkProductionModel = require("../models/milkProductionModel");

/**
 * Render recent milk production records for the logged-in farmer.
 */
async function listProductions(req, res) {
  try {
    const productions = await MilkProductionModel.getRecentByFarmerId(
      req.session.farmer.farmer_id
    );
    return res.render("milk-production.ejs", { productions });
  } catch (err) {
    console.error("Milk production list error:", err);
    return res.status(500).send("Server Error!");
  }
}

/**
 * Render the form to add a milk production record.
 */
async function showAddForm(req, res) {
  try {
    const animals = await AnimalModel.findMilkingAnimalsByFarmerId(
      req.session.farmer.farmer_id
    );
    return res.render("add-milk-production.ejs", { animals });
  } catch (err) {
    console.error("Show add milk production form error:", err);
    return res.status(500).send("Server Error!");
  }
}

/**
 * Record a new milk production entry for an animal owned by the logged-in farmer.
 */
async function addProduction(req, res) {
  try {
    const {
      animal_unique_val,
      production_date,
      production_time,
      quantity,
      quality,
    } = req.body || {};

    if (!animal_unique_val || !production_date || !production_time || !quantity) {
      return res.status(400).send("Missing required milk production fields.");
    }

    const ownedAnimal = await AnimalModel.findByTagAndFarmerId(
      animal_unique_val,
      req.session.farmer.farmer_id
    );
    if (!ownedAnimal) {
      return res.status(403).send("Unauthorized animal selection.");
    }

    await MilkProductionModel.create({
      animal_id: animal_unique_val,
      production_date,
      production_time,
      quantity,
      quality,
    });

    return res.redirect("/milk-production");
  } catch (err) {
    console.error("Add milk production error:", err);
    return res.status(500).send("Server Error!");
  }
}

module.exports = {
  listProductions,
  showAddForm,
  addProduction,
};

