const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
app.use(
  cors({
    origin: "*",
  })
);
const port = process.env.PORT || 3000;
app.use("/videos", express.static(path.join(__dirname, "videos")));
app.get("/", (req, res) => res.send("Hello World!"));
app.listen(port, () => console.log("Server running on " + port));
