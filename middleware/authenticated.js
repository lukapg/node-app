module.exports = {
  authenticated: function (req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash("error_message", "You must be logged in");
    res.redirect("/login");
  },
  loginPage: function (req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect("/");
    }
    return next();
  },
};
