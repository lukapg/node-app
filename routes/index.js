const router = require("express").Router();
const db = require("../util/db");
const passport = require("passport");
const { authenticated, loginPage } = require("../middleware/authenticated");
const { checkUrlExists } = require("../util/functions");
const bcrypt = require("bcrypt");
const validUrl = require("valid-url");
const axios = require("axios");

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

router.get("/statistics", authenticated, async (req, res) => {
  try {
    const jobs = await db.query(
      "select count(*) as all_time_jobs, (select name from jobs where exists (select * from keywords where status = false) order by id asc limit 1) as job_name, (select count(*) as total from jobs where not exists (select * from keywords where status = false)) as jobs_ready, (select count(*) as total from jobs where exists (select * from keywords where status = false)) as jobs_pending from jobs where user_id = $1",
      [req.user.id]
    );
    const keywords = await db.query(
      "select (select count(*) from keywords where callback_result = 'success') as all_time_keywords, (select count(*) from keywords where status = true and callback_result = 'success' and job_id = (select id from jobs where exists (select * from keywords where status = false) order by id asc limit 1)) as keywords_ready, (select name from keywords where status = false order by id asc limit 1) as keyword_name, count(*) filter (where keywords.status = false) as keywords_pending from keywords where user_id = $1",
      [req.user.id]
    );
    let returnData = {
      all_time_jobs: jobs.rows[0].all_time_jobs,
      job_name: jobs.rows[0].job_name,
      jobs_ready: jobs.rows[0].jobs_ready,
      jobs_pending: jobs.rows[0].jobs_pending,
      keywords_ready: keywords.rows[0].keywords_ready,
      keywords_pending: keywords.rows[0].keywords_pending,
      keyword_name: keywords.rows[0].keyword_name,
      all_time_keywords: keywords.rows[0].all_time_keywords,
    };
    return res.status(200).json({ data: returnData });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/history", authenticated, async (req, res) => {
  let jobs = null;
  const domains = await db.query(
    "select domains.*, (select count(*) from keywords where keywords.domain_id = domains.id) as total from domains where user_id = $1",
    [req.user.id]
  );
  if (domains.rowCount > 0) {
    let domainIds = domains.rows.map((domain) => Number(domain.id));
    jobs = await db.query(
      `select jobs.id, jobs.hash_id, jobs.domain_id, jobs.name, jobs.author, jobs.category, TO_CHAR(jobs.created_at, 'DD/MM/YYYY HH24:MI:SS') as created_at, COUNT(keywords.id) filter (where keywords.status = true) as completed, COUNT(keywords.id) as total from jobs
      left join domains on domains.id = jobs.domain_id left join keywords on keywords.job_id = jobs.id where jobs.domain_id in (${domainIds}) and jobs.user_id = $1 group by jobs.id`,
      [req.user.id]
    );
  }
  res.render("history.ejs", {
    title: "Job history",
    user: req.user,
    domains: domains.rows,
    jobs: domains.rowCount > 0 ? jobs.rows : null,
  });
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
  let words = [];

  if (req.user.is_admin) {
    users = await db.query(
      "select * from users where active = $1 and is_admin = $2",
      [true, false]
    );
  }
  let blacklist = await db.query("select * from blacklist where user_id = $1", [
    req.user.id,
  ]);
  blacklist.rows.forEach((el) => {
    words.push(el.word);
  });
  words = words.join("\r\n");
  res.render("settings.ejs", {
    title: "Settings",
    user: req.user,
    users: req.user.is_admin ? users.rows : null,
    words: words,
  });
});

router.post("/create_user", authenticated, async (req, res, next) => {
  try {
    if (!req.user.is_admin) return next();
    const { email, password } = req.body;
    // Check if an active user with this e-mail address already exists; if it does return
    const hashedPassword = await bcrypt.hash(password, 10);
    const userExists = await db.query(
      "select * from users where email = $1 and active = $2",
      [email, true]
    );
    if (userExists.rows.length > 0) {
      req.flash("error_message", "User already exists.");
      return res.redirect("/settings");
    }
    // Check if a user who is deactivated already exists, if it does, just update the active field, else create a new one
    const deactivatedUserExists = await db.query(
      "select * from users where email = $1 and active = $2",
      [email, false]
    );
    if (deactivatedUserExists.rows.length > 0) {
      await db.query(
        "update users set active = $1, password = $2 where email = $3",
        [true, hashedPassword, email]
      );
    } else {
      await db.query(
        "INSERT INTO users(email, password, is_admin, active) values ($1, $2, $3, $4) returning *",
        [email, hashedPassword, false, true]
      );
    }
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
    let domainValid = validUrl.isUri(domain);

    let pluginUrl = String(domain).endsWith("/")
      ? "wp-json/post-wiz/v1/publish-post"
      : "/wp-json/post-wiz/v1/publish-post";
    let domainPluginUrl = domain + pluginUrl;

    //let urlActive = checkUrlExists(domainPluginUrl);

    if (!domainValid) {
      req.flash(
        "error_message",
        "Please enter a domain that is valid and on which the Plugin is installed and activated!"
      );
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
    return res.redirect("/domains");
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

router.post("/update_composer_api", authenticated, async (req, res, next) => {
  try {
    const { request_url, api_key } = req.body;
    if (!validUrl.isUri(request_url)) {
      req.flash("error_message", "Please enter a valid URL!");
      return res.redirect("/settings");
    }
    const composerUpdated = await db.query(
      "update users set request_url = $1, api_key = $2 where id = $3",
      [request_url, api_key, req.user.id]
    );
    req.flash("success_message", "Settings updated successfully.");
    return res.redirect("/settings");
  } catch (error) {
    req.flash("error_message", error.message);
    return next();
  }
});

router.post("/update_parameters", authenticated, async (req, res, next) => {
  try {
    const { minimum_word_length, minimum_seo_score } = req.body;
    if (!minimum_word_length || !minimum_seo_score) {
      req.flash(
        "error_message",
        "Minimum word length and minumum SEO score must be defined"
      );
      return res.redirect("/settings");
    }
    const parametersUpdated = await db.query(
      "update users set minimum_word_length = $1, minimum_seo_score = $2 where id = $3",
      [minimum_word_length, minimum_seo_score, req.user.id]
    );
    req.flash("success_message", "Parameters updated successfully.");
    return res.redirect("/settings");
  } catch (error) {
    req.flash("error_message", error.message);
    return next();
  }
});

router.post("/update_blacklist", authenticated, async (req, res, next) => {
  try {
    const { blacklist } = req.body;
    if (!blacklist) {
      req.flash(
        "error_message",
        "You haven't provided any words for the blacklist"
      );
      return res.redirect("/settings");
    }
    let deleteResult = await db.query(
      "delete from blacklist where user_id = $1",
      [req.user.id]
    );
    let words = [];
    words = blacklist.split("\n");
    words = words.filter((word) => word != "\r" && word != "");
    words.forEach(async (el, i, arr) => {
      arr[i] = el.replace(/[^a-zA-Z0-9-_ ]/g, "");
      await db.query("insert into blacklist (user_id, word) values ($1, $2)", [
        req.user.id,
        arr[i],
      ]);
    });
    req.flash("success_message", "Blacklist updated successfully.");
    return res.redirect("/settings");
  } catch (error) {
    req.flash("error_message", error.message);
    return next();
  }
});

router.get("/create-job", authenticated, async (req, res) => {
  const domains = await db.query("select * from domains where user_id = $1", [
    req.user.id,
  ]);
  res.render("create_job", {
    title: "Create new job",
    user: req.user,
    domains: domains.rows,
  });
});

router.post("/post_job", authenticated, async (req, res, next) => {
  try {
    const { name, category, domain, author, keywords } = req.body;
    if (!name || !domain || !keywords) {
      req.flash("error_message", "Please fill all required fields");
      return res.redirect("/create-job");
    }

    let blacklistWords = [];
    let keywordsArray = [];
    keywordsArray = keywords.split("\n");

    keywordsArray.forEach((el, i, arr) => {
      arr[i] = el.replace(/[^a-zA-Z0-9-_ ]/g, "");
    });

    const domainDetails = await db.query(
      "select * from domains where id = $1",
      [domain]
    );

    const domainName = domainDetails.rows[0].name;
    const domainSecretKey = domainDetails.rows[0].secret_key;
    const domainFeaturedImage = domainDetails.rows[0].set_image;

    let pluginUrl = String(domainName).endsWith("/")
      ? "wp-json/post-wiz/v1/publish-post"
      : "/wp-json/post-wiz/v1/publish-post";
    let domainPluginUrl = domainName + pluginUrl;

    let blacklist = await db.query(
      "select * from blacklist where user_id = $1",
      [req.user.id]
    );
    blacklist.rows.forEach((el) => {
      blacklistWords.push(el.word);
    });

    blacklistWords = blacklistWords.join(", ");
    let keywordsWords = keywordsArray.join(", ");

    const hashId = Array.from(Array(16), () =>
      Math.floor(Math.random() * 36).toString(36)
    ).join("");

    const apiBody = {
      "api key": req.user.api_key,
      "wordpress url": domainPluginUrl,
      "secret key": domainSecretKey,
      "add featured image": domainFeaturedImage,
      category: category,
      author: author,
      "minimum word count": req.user.minimum_word_length,
      "minimum ink score": req.user.minimum_seo_score,
      "blacklisted words": blacklistWords,
      keywords: keywordsWords,
      "callback url": req.protocol + "://" + req.hostname + "/callback",
      "job id": hashId,
    };

    res.send(apiBody);

    //const brunoApiResponse = await axios.post(req.user.request_url, apiBody);

    // const jobCreated = await db.query(
    //   "insert into jobs (hash_id, user_id, domain_id, name, category, author) values ($1, $2, $3, $4, $5, $6) returning *",
    //   [hashId, req.user.id, domain, name, category, author]
    // );

    // keywordsArray.forEach(async (el, i, arr) => {
    //   arr[i] = el.replace(/[^a-zA-Z0-9-_ ]/g, "");
    //   await db.query(
    //     "insert into keywords (user_id, job_id, domain_id, name, status) values ($1, $2, $3, $4, $5)",
    //     [req.user.id, jobCreated.rows[0].id, domain, arr[i], 0]
    //   );
    // });
    // req.flash("success_message", "Job created successfully");
    // return res.redirect("/history");
  } catch (error) {
    req.flash("error_message", error.message);
    console.log(error);
    return next();
  }
});

router.get("/download-keywords/:jobId", authenticated, async (req, res) => {
  const jobId = req.params.jobId;
  let keywords = await db.query(
    "select keywords.name from keywords where job_id = $1",
    [jobId]
  );
  let text = "";
  keywords.rows.forEach((word, index, array) => {
    if (array[array.length - 1] === word) {
      text = text.concat(word.name);
    } else {
      text = text.concat(word.name + "\n");
    }
  });
  res.setHeader("Content-type", "application/octet-stream");
  res.setHeader("Content-disposition", "attachment; filename=keywords.txt");
  res.send(text);
});

router.get("/download-logs/:hashId", authenticated, async (req, res) => {
  const hashId = req.params.hashId;
  const job = await db.query("select * from jobs where hash_id = $1", [hashId]);
  let logs = await db.query("select * from callback_logs where job_id = $1", [
    job.rows[0].id,
  ]);
  let text = "";
  logs.rows.forEach((log, index, array) => {
    if (array[array.length - 1] === log) {
      text = text.concat(log.keyword + " - " + log.status);
    } else {
      text = text.concat(log.keyword + " - " + log.status + "\n");
    }
  });
  res.setHeader("Content-type", "application/octet-stream");
  res.setHeader("Content-disposition", "attachment; filename=logs.txt");
  res.send(text);
});

router.post("/callback", async (req, res) => {
  try {
    const { keyword, status } = req.body;
    const job_id = req.body["job id"];

    if (!keyword || !status || !job_id) {
      return res.status(400).json({
        error:
          "You have to specify all required parameters for the callback URL",
      });
    }

    const job = await db.query("select * from jobs where hash_id = $1", [
      job_id,
    ]);

    const updateResult = await db.query(
      "update keywords set status = true, callback_result = $1 where job_id = $2 and name = $3",
      [status, job.rows[0].id, keyword]
    );

    const insertLog = await db.query(
      "insert into callback_logs(job_id, keyword, status) values($1, $2, $3)",
      [job.rows[0].id, keyword, status]
    );

    return res.status(200).json({ data: "Callback success" });
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
