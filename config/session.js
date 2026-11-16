const session = require("express-session");

const SESSION_COOKIE_NAME = "dairyman.sid";

/**
 * Create the configured express-session middleware.
 * @returns {import("express").RequestHandler}
 */
function createSessionMiddleware() {
  return session({
    name: SESSION_COOKIE_NAME,
    secret:
      process.env.SESSION_SECRET || "ojfsklfsmkfsmfsjfskjkfsjfkjkfjs",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  });
}

module.exports = {
  SESSION_COOKIE_NAME,
  createSessionMiddleware,
};
