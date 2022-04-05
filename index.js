const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const expressLayouts = require("express-ejs-layouts");
const dotenv = require("dotenv");
const routes = require("./routes");
const passport = require("passport");
const session = require("express-session");
const flash = require("connect-flash");

require("./util/passport")(passport);

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(expressLayouts);
app.set("layout", "./layouts/main");
app.set("view engine", "ejs");
app.use(helmet());
app.use(compression());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_message = req.flash("success_message");
  res.locals.error_message = req.flash("error_message");
  res.locals.error = req.flash("error");
  next();
});

app.use("/", routes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
