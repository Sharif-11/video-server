const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const sizeOf = require("image-size");
app.use(
  cors({
    origin: "*",
  })
);
// Ensure the videos directory exists
const uploadDir = path.join(__dirname, "videos");
const thumbnailDir = path.join(__dirname, "thumbnails");
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
  // find the origin please of this server not the client
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.json({
    message: "Video uploaded successfully!",
    filename: req.file.filename,
    url: `${baseUrl}/videos/${req.file.filename}`,
  });
});
app.get("/videos", async (req, res) => {
  try {
    const videos = fs.readdirSync(uploadDir);
    const thumbnails = fs.readdirSync(thumbnailDir);
    // here videos contains video and thumbnail contain thubnail of the videos. the name of the thubnail of a videos is a video name with the extension of .png. now I want to send the videos and thubnail in a single array of object. each object contains the url,thumbnail and I  need to send width and height of thumbnail also
    // please use image-size package to get the width and height of the image
    // https://www.npmjs.com/package/image-size
    // https://www.npmjs.com/package/image-size
    // https://www.npmjs.com/package/image-size
    // https://www.npmjs.com/package/image-size

    videos.forEach((video, index) => {
      const { width, height } = sizeOf(`${thumbnailDir}/${thumbnails[index]}`);
      videos[index] = {
        url: `${req.protocol}://${req.get("host")}/videos/${video}`,
        img: `${req.protocol}://${req.get("host")}/thumbnails/${video.replace(
          path.extname(video),
          ".png"
        )}`,
        width,
        height,
      };
    });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve videos" });
  }
});

const port = process.env.PORT || 3000;
app.use("/videos", express.static(path.join(__dirname, "videos")));
app.use("/thumbnails", express.static(path.join(__dirname, "thumbnails")));
app.get("/", (req, res) => res.send("Hello World!"));
app.listen(port, () => console.log("Server running on " + port));
