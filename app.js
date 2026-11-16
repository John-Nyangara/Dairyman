const express = require("express");
const path = require("path");
const { createSessionMiddleware } = require("./config/session");
const { attachFarmerToLocals } = require("./middleware/authMiddleware");

const indexRoutes = require("./routes/indexRoutes");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const animalRoutes = require("./routes/animalRoutes");
const milkProductionRoutes = require("./routes/milkProductionRoutes");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(createSessionMiddleware());
app.use(attachFarmerToLocals);

app.use("/", indexRoutes);
app.use("/", authRoutes);
app.use("/", dashboardRoutes);
app.use("/", animalRoutes);
app.use("/", milkProductionRoutes);

module.exports = app;

