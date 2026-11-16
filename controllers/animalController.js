const AnimalModel = require("../models/animalModel");
const MilkProductionModel = require("../models/milkProductionModel");
const { getChartData } = require("../utils/chartHelpers");

/**
 * Render animal profiles and per-animal total production chart.
 */
async function listProfiles(req, res) {
  try {
    const farmerId = req.session.farmer.farmer_id;
    const [animalTotals, allAnimalsForFarmer] = await Promise.all([
      MilkProductionModel.getAnimalTotalsByFarmerId(farmerId),
      AnimalModel.findByFarmerId(farmerId),
    ]);

    return res.render("animal-profiles.ejs", {
      animals: getChartData(animalTotals),
      allAnimalsForFarmer,
    });
  } catch (err) {
    console.error("Animal profiles error:", err);
    return res.status(500).send("Server Error!");
  }
}

/**
 * Register a new animal for the logged-in farmer.
 */
async function createAnimal(req, res) {
  try {
    const {
      animal_tag,
      dob,
      purchase_date,
      breed,
      name,
      source,
      gender,
      status,
    } = req.body || {};

    if (!animal_tag || !name || !dob || !source || !gender || !status) {
      return res.status(400).send("Missing required animal fields.");
    }

    await AnimalModel.create({
      animal_tag,
      name,
      dob,
      purchase_date,
      breed,
      status,
      source,
      gender,
      owner_id: req.session.farmer.farmer_id,
      imagename: req.file ? req.file.filename : "",
    });

    return res.redirect("/animal-profiles");
  } catch (err) {
    console.error("Create animal error:", err);
    return res.status(500).send("Server Error!");
  }
}

module.exports = {
  listProfiles,
  createAnimal,
};

