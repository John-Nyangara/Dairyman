const express = require("express");
const animalController = require("../controllers/animalController");
const { requireAuth } = require("../middleware/authMiddleware");
const upload = require("../config/upload");

const router = express.Router();

router.get("/animal-profiles", requireAuth, animalController.listProfiles);
router.post(
  "/new-animal",
  requireAuth,
  upload.single("picture"),
  animalController.createAnimal
);

module.exports = router;

