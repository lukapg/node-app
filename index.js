const express = require("express");
const dotenv = require("dotenv");
const app = express();

dotenv.config();

app.get("/", (req, res) => {
  res.send("Hello world");
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
