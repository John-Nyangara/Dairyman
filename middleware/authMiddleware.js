/**
 * Populate res.locals.farmer on every request when a session exists.
 */
function attachFarmerToLocals(req, res, next) {
  res.locals.farmer =
    req.session && req.session.farmer ? req.session.farmer : null;
  next();
}

/**
 * Protect routes by requiring an authenticated farmer session.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.farmer && req.session.farmer.farmer_id) {
    res.locals.farmer = req.session.farmer;
    return next();
  }
  return res.redirect("/login?message=unauthorized");
}

module.exports = {
  attachFarmerToLocals,
  requireAuth,
};

