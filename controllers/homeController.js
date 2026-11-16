/**
 * Render the public landing page.
 */
function renderLandingPage(req, res) {
  res.render("index.ejs");
}

module.exports = {
  renderLandingPage,
};

