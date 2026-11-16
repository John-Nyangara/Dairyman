const express = require("express");
const milkProductionController = require("../controllers/milkProductionController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/milk-production",
  requireAuth,
  milkProductionController.listProductions
);
router.get(
  "/add-milk-production",
  requireAuth,
  milkProductionController.showAddForm
);
router.post(
  "/add-milk-production",
  requireAuth,
  milkProductionController.addProduction
);

module.exports = router;

