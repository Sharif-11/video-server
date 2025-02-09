const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
app.use(
  cors({
    origin: "*",
  })
);
// Ensure the videos directory exists
const uploadDir = path.join(__dirname, "videos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
  },
});

const upload = multer({ storage });

// Upload API
app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded!" });
  }
  res.json({
    message: "Video uploaded successfully!",
    filename: req.file.filename,
    url: `/videos/${req.file.filename}`,
  });
});
const port = process.env.PORT || 3000;
app.use("/videos", express.static(path.join(__dirname, "videos")));
app.get("/", (req, res) => res.send("Hello World!"));
app.listen(port, () => console.log("Server running on " + port));
