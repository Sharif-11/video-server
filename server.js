const express = require("express");
const app = express();
const path = require("path");

app.use("/videos", express.static(path.join(__dirname, "videos")));

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
