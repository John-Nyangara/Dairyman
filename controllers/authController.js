const FarmerModel = require("../models/farmerModel");
const { SESSION_COOKIE_NAME } = require("../config/session");

const LOGIN_MESSAGES = {
  exists: "Email already exists. Please login.",
  success: "Registration successful. Please login.",
  invalid: "Invalid email or password. Try again.",
  unauthorized: "You are unauthorized to access that page.",
  logged_out: "You have been logged out.",
};

const REGISTER_MESSAGES = {
  invalid: "Please fill in all required fields.",
  password_short: "Password must be at least 6 characters long.",
  error: "Error while registering farmer. If this persists contact admin.",
};

/**
 * Persist the authenticated farmer into a regenerated session.
 * @param {import("express").Request} req
 * @param {object} safeFarmer
 * @returns {Promise<void>}
 */
function persistFarmerSession(req, safeFarmer) {
  return new Promise((resolve, reject) => {
    const assignAndSave = () => {
      req.session.farmer = safeFarmer;
      if (typeof req.session.save === "function") {
        req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
      } else {
        resolve();
      }
    };

    if (typeof req.session.regenerate === "function") {
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          return reject(regenErr);
        }
        assignAndSave();
      });
    } else {
      assignAndSave();
    }
  });
}

/**
 * Render the farmer registration page.
 */
function showRegister(req, res) {
  const messageKey = req.query.message;
  if (messageKey && REGISTER_MESSAGES[messageKey]) {
    res.locals.message = REGISTER_MESSAGES[messageKey];
  }
  res.render("register.ejs");
}

/**
 * Handle farmer registration with bcrypt password hashing.
 */
async function register(req, res) {
  const {
    email,
    phone,
    password,
    fullname,
    farm_location,
    farm_name,
    county,
  } = req.body || {};

  if (
    typeof fullname !== "string" ||
    fullname.trim().length === 0 ||
    typeof email !== "string" ||
    email.trim().length === 0 ||
    typeof password !== "string"
  ) {
    return res.redirect("/register?message=invalid");
  }

  if (password.length < 6) {
    return res.redirect("/register?message=password_short");
  }

  try {
    const existingFarmer = await FarmerModel.findByEmail(email);
    if (existingFarmer) {
      return res.redirect("/login?message=exists");
    }

    await FarmerModel.create({
      fullname,
      phone,
      email,
      password,
      county,
      farm_location,
      farm_name,
    });

    return res.redirect("/login?message=success");
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.redirect("/login?message=exists");
    }
    console.error("Registration error:", err);
    return res.status(500).send(REGISTER_MESSAGES.error);
  }
}

/**
 * Render the farmer login page.
 */
function showLogin(req, res) {
  const messageKey = req.query.message;
  if (messageKey && LOGIN_MESSAGES[messageKey]) {
    res.locals.message = LOGIN_MESSAGES[messageKey];
  }
  res.render("login.ejs");
}

/**
 * Authenticate a farmer using email and bcrypt password comparison.
 */
async function login(req, res) {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    email.trim().length === 0 ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    return res.redirect("/login?message=invalid");
  }

  try {
    const farmer = await FarmerModel.findByEmail(email);
    if (!farmer) {
      return res.redirect("/login?message=invalid");
    }

    const passwordMatch = await FarmerModel.verifyPassword(
      password,
      farmer.password
    );
    if (!passwordMatch) {
      return res.redirect("/login?message=invalid");
    }

    await persistFarmerSession(req, FarmerModel.toSafeSessionUser(farmer));
    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).send("Server Error");
  }
}

/**
 * Destroy the active farmer session and redirect to login.
 */
function logout(req, res) {
  if (!req.session) {
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.redirect("/login?message=logged_out");
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.redirect("/login?message=logged_out");
  });
}

module.exports = {
  showRegister,
  register,
  showLogin,
  login,
  logout,
};

