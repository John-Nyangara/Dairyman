const path = require("path");
const multer = require("multer");

const upload = multer({
  dest: path.join(__dirname, "..", "public", "images"),
});

module.exports = upload;

