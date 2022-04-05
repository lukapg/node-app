const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const db = require("../util/db");

module.exports = function (passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const users = await db.query(
            "select * from users where email = $1 and active = $2",
            [email, true]
          );
          if (users.rows.length === 0)
            return done(null, false, { message: "User does not exist." });
          bcrypt.compare(password, users.rows[0].password, (error, isMatch) => {
            if (error) throw error;
            if (!isMatch)
              return done(null, false, { message: "Login failed." });
            return done(null, users.rows[0]);
          });
        } catch (error) {
          return done(null, false, error.message);
        }
      }
    )
  );
  passport.serializeUser(function (user, done) {
    done(null, user.id);
  });
  passport.deserializeUser(async function (id, done) {
    try {
      const users = await db.query("select * from users where id = $1", [id]);
      done(null, users.rows[0]);
    } catch (error) {
      done(error);
    }
  });
};
