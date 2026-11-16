const MilkProductionModel = require("../models/milkProductionModel");
const { groupAndExtractLatest } = require("../utils/chartHelpers");

/**
 * Render the farmer dashboard with recent milk production trend charts.
 */
async function showDashboard(req, res) {
  try {
    const records = await MilkProductionModel.getDailyTotalsByFarmerId(
      req.session.farmer.farmer_id
    );
    const groupedData = groupAndExtractLatest(records);
    return res.render("dashboard.ejs", { groupedData });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).send("Server Error!");
  }
}

module.exports = {
  showDashboard,
};

