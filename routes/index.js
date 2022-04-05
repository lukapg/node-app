const router = require("express").Router();
const db = require("../util/db");
const passport = require("passport");
const { authenticated, loginPage } = require("../middleware/authenticated");
const bcrypt = require("bcrypt");
const validUrl = require("valid-url");

router.get("/login", loginPage, (req, res) => {
  res.render("login", { title: "Login", layout: "./layouts/login" });
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })(req, res, next);
});

router.get("/", authenticated, (req, res) => {
  res.render("index", { title: "Home Page", user: req.user });
});

router.get("/history", authenticated, (req, res) => {
  res.render("history.ejs", { title: "Job history", user: req.user });
});

router.get("/domains", authenticated, async (req, res) => {
  const domains = await db.query("select * from domains where user_id = $1", [
    req.user.id,
  ]);

  res.render("domains.ejs", {
    title: "My domains",
    user: req.user,
    domains: domains.rows,
  });
});

router.get("/settings", authenticated, async (req, res) => {
  let users = null;
  if (req.user.is_admin) {
    users = await db.query(
      "select * from users where active = $1 and is_admin = $2",
      [true, false]
    );
  }
  res.render("settings.ejs", {
    title: "Settings",
    user: req.user,
    users: req.user.is_admin ? users.rows : null,
  });
});

router.post("/create_user", authenticated, async (req, res, next) => {
  try {
    if (!req.user.is_admin) return next();
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const userExists = await db.query("select * from users where email = $1", [
      email,
    ]);
    if (userExists.rows.length > 0) {
      req.flash("error_message", "User already exists.");
      return res.redirect("/settings");
    }
    const newUser = await db.query(
      "INSERT INTO users(email, password, is_admin, active) values ($1, $2, $3, $4) returning *",
      [email, hashedPassword, false, true]
    );
    req.flash("success_message", "User was added successfully.");
    res.redirect("/settings");
  } catch (error) {
    req.flash("error_message", error.message);
    return next();
  }
});

router.post("/change_password", authenticated, async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body;
    const hashedPassword = await bcrypt.hash(new_password, 10);
    const validPassword = await bcrypt.compare(old_password, req.user.password);
    if (!validPassword) {
      req.flash("error_message", "Your old password is not correct");
      return res.redirect("/settings");
    }
    const passwordUpdate = await db.query(
      "update users set password = $1 where id = $2",
      [hashedPassword, req.user.id]
    );
    req.flash("success_message", "Password was update successfully");
    res.redirect("/settings");
  } catch (error) {
    req.flash("error_message", error.message);
    return next();
  }
});

router.post("/force_login", authenticated, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!req.user.is_admin) return next();
    const user = await db.query("select * from users where email = $1", [
      email,
    ]);
    if (user.rows.length == 0) {
      req.flash("error_message", "User does not exist");
      return res.redirect("/settings");
    }
    req.logIn(user.rows[0], (error) => {
      if (error) {
        req.flash("error_message", error);
      } else {
        req.flash("success_message", `Successfully logged in as ${email}`);
      }
      res.redirect("/");
    });
  } catch (error) {
    req.flash("error_message", error.message);
    return next();
  }
});

router.post("/delete_user", authenticated, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!req.user.is_admin)
      return res.status(403).json({ error: "You cannot delete this user." });
    if (!user_id)
      return res.status(401).json({ error: "Error while deleting user." });
    const userUpdated = await db.query(
      "update users set active = $1 where id = $2",
      [false, user_id]
    );
    if (!userUpdated) {
      return res.status(500).json({ error: "Error while deleting user." });
    }
    res.status(200).json({ message: "User deleted." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/domains/create", authenticated, async (req, res, next) => {
  try {
    const { domain, secret_key, set_image } = req.body;
    if (!validUrl.isUri(domain)) {
      req.flash("error_message", "Please enter a valid domain!");
      return res.redirect("/domains");
    }
    const domainExists = await db.query(
      "select * from domains where name = $1 and user_id = $2",
      [domain, req.user.id]
    );
    if (domainExists.rows.length > 0) {
      req.flash("error_message", "Domain already exists");
      return res.redirect("/domains");
    }
    const newDomain = await db.query(
      "INSERT INTO domains(user_id, name, secret_key, set_image) values ($1, $2, $3, $4) returning *",
      [req.user.id, domain, secret_key, set_image ? true : false]
    );
    req.flash("success_message", "Domain was added successfully.");
    res.redirect("/domains");
  } catch (error) {
    req.flash("error_message", error.message);
    return next();
  }
});

router.post("/delete_domain", authenticated, async (req, res) => {
  try {
    const { domain_id } = req.body;
    if (!domain_id)
      return res.status(401).json({ error: "Error while deleting domain." });
    const domainDeleted = await db.query("delete from domains where id = $1", [
      domain_id,
    ]);
    if (!domainDeleted) {
      return res.status(500).json({ error: "Error while deleting domain." });
    }
    res.status(200).json({ message: "Domain deleted." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/logout", authenticated, (req, res) => {
  req.logout();
  req.flash("success_message", "You have been logged out.");
  res.redirect("/login");
});

module.exports = router;
