const express = require("express");
const cors = require("cors");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const sizeOf = require("image-size");

app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);
// Ensure the videos directory exists
const uploadDir = path.join(__dirname, "public");
const imageDir = path.join(__dirname, "images");

const thumbnailDir = path.join(__dirname, "thumbnails");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}

// Configure Multer for file uploads
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
  },
});
const exportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "exports"));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Keep the original file name
  },
});

const upload = multer({ storage: uploadStorage });
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imageDir);
  },
  filename: (req, file, cb) => {
    fs.readdir(imageDir, (err, files) => {
      if (err) {
        return cb(err, null);
      }

      // Count existing images and determine the next index
      const imageIndex = files.length + 1; // Start from 1
      const fileExtension = path.extname(file.originalname);
      const newFileName = `image-${imageIndex}${fileExtension}`;

      cb(null, newFileName);
    });
  },
});
const imageUpload = multer({ storage: imageStorage });
const exportUpload = multer({ storage: exportStorage });

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
// create a route to upload multiple images at once and the images should be saved under a new folder each time the user uploads images. the folder name should be the current date and time in the format of "YYYY-MM-DD-HH-MM-SS"
// for example if the user uploads images at 2021-09-01 12:30:45 then the images should be saved under the folder "2021-09-01-12-30-45"
// if the user uploads images at 2021-09-01 12:31:45 then the images should be saved under the folder "2021-09-01-12-31-45"
// if the user uploads images at 2021-09-01 12:32:45 then the images should be saved under the folder "2021-09-01-12-32-45"
// and so on
// the images should be saved under the folder with the original name of the image
// for example if the user uploads an image named "image1.png" then the image should be saved under the folder "2021-09-01-12-30-45" with the name "image1.png"

app.post("/upload-image", imageUpload.array("images"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded!" });
  }

  try {
    // Create a unique folder for this upload
    const folderName = path.join(__dirname, "uploads", `${Date.now()}`);
    fs.mkdirSync(folderName, { recursive: true });

    // Process uploaded images and rename them in sequential order (Start from 1)
    let idx = 0;
    req.files.forEach((file, index) => {
      const newFilePath = path.join(folderName, `image-${idx + 1}.png`); // Start from 1

      if (fs.existsSync(file.path)) {
        fs.renameSync(file.path, newFilePath);
        idx++;
      } else {
        console.warn(`File not found: ${file.path}`);
      }
    });

    // Define the output directory for videos
    const downloadFolder = path.join(__dirname, "downloads");
    fs.mkdirSync(downloadFolder, { recursive: true });

    const outputVideo = path.join(downloadFolder, `output-${Date.now()}.mp4`);

    // FFmpeg command using image sequence
    ffmpeg()
      .input(`${folderName}/image-%d.png`) // Use image sequence (corrected format)
      .inputOptions(["-framerate 25", "-start_number 1"]) // Set framerate & ensure correct order
      .outputOptions([
        "-pix_fmt yuv420p", // Ensure compatibility
        "-vf scale=1920:1080:force_original_aspect_ratio=decrease", // Resize
      ])
      .output(outputVideo)
      .fps(25) // Set frame rate
      .videoCodec("libx264") // Use H.264 codec
      .on("end", () => {
        console.log("Video created successfully!");
        fs.rmSync(folderName, { recursive: true, force: true });

        res.json({
          message: "Video created successfully!",
          url: `${req.protocol}://${req.get("host")}/downloads/${path.basename(
            outputVideo
          )}`,
        });
      })
      .on("error", (err) => {
        console.error("FFmpeg Error:", err);
        fs.rmSync(folderName, { recursive: true, force: true });
        res
          .status(500)
          .json({ message: "Error creating video", error: err.message });
      })
      .run();
  } catch (error) {
    console.error("Server Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

app.get("/", (req, res) => {
  const image1Path = path.join(__dirname, "images", "image-base.png"); // First image
  const image2Path = path.join(__dirname, "images", "image-2.png"); // Second image
  const overlayVideoPath = path.join(__dirname, "videos", "video_04.mp4"); // Third video (direct path)
  const outputVideo1Path = path.join(__dirname, "output1.mp4"); // First video
  const outputVideo2Path = path.join(__dirname, "output2.mp4"); // Second video
  const intermediateOutputPath = path.join(
    __dirname,
    "intermediate-output.mp4"
  ); // Intermediate video
  const finalOutputPath = path.join(__dirname, "final-output.mp4"); // Final video
  const duration = parseInt(req.query.duration) || 5; // Default 5s
  const time = new Date().getTime();

  // Check if the overlay video exists
  if (!fs.existsSync(overlayVideoPath)) {
    return res
      .status(404)
      .send("Overlay video not found in the specified folder.");
  }

  // Get the duration of the overlay video
  ffmpeg.ffprobe(overlayVideoPath, (err, metadata) => {
    if (err) {
      console.error("Error getting overlay video metadata:", err.message);
      return res.status(500).send("Error getting overlay video metadata");
    }

    const overlayDuration = metadata.format.duration; // Duration of the overlay video in seconds

    // Generate the first video from image-base.png
    ffmpeg()
      .input(image1Path)
      .loop(duration) // Loop image for n seconds
      .fps(25) // Set frame rate
      .videoCodec("libx264") // Use H.264 encoding
      .size("1280x720") // Set resolution
      .outputOptions("-pix_fmt yuv420p") // Ensure compatibility
      .outputOptions("-t " + duration) // Set duration
      .outputOptions("-preset medium") // Better quality encoding
      .outputOptions("-crf 18") // Lower CRF for better quality
      .on("start", (command) =>
        console.log("FFmpeg command (Video 1):", command)
      )
      .on("end", () => {
        console.log("First video generated successfully.");

        // Generate the second video from image-2.png
        ffmpeg()
          .input(image2Path)
          .loop(duration) // Loop image for n seconds
          .fps(25) // Set frame rate
          .videoCodec("libx264") // Use H.264 encoding
          .size("1280x720") // Set resolution
          .outputOptions("-pix_fmt yuv420p") // Ensure compatibility
          .outputOptions("-t " + duration) // Set duration
          .outputOptions("-preset medium") // Better quality encoding
          .outputOptions("-crf 18") // Lower CRF for better quality
          .on("start", (command) =>
            console.log("FFmpeg command (Video 2):", command)
          )
          .on("end", () => {
            console.log("Second video generated successfully.");

            // Overlay the two videos to create an intermediate result
            ffmpeg()
              .input(outputVideo1Path) // First video as base
              .input(outputVideo2Path) // Second video to overlay
              .complexFilter([
                "[0:v][1:v] overlay=W-w-10:H-h-10 [outv]", // Overlay second video on top of the first
              ])
              .map("[outv]") // Map the output video stream
              .videoCodec("libx264") // Use H.264 encoding
              .outputOptions("-preset medium") // Better quality encoding
              .outputOptions("-crf 18") // Lower CRF for better quality
              .on("start", (command) =>
                console.log("FFmpeg command (Intermediate Overlay):", command)
              )
              .on("end", () => {
                console.log("Intermediate video generated successfully.");

                // Overlay the intermediate result with the third video
                const finalFFmpeg = ffmpeg()
                  .input(intermediateOutputPath) // Intermediate video as base
                  .input(overlayVideoPath) // Third video to overlay
                  .complexFilter([
                    // Enable the overlay only during the duration of the overlay video
                    `[1:v] setpts=PTS-STARTPTS [overlay]; ` +
                      `[0:v][overlay] overlay=10:10:enable='between(t,0,${overlayDuration})' [outv]`,
                  ])
                  .map("[outv]") // Map the output video stream
                  .videoCodec("libx264") // Use H.264 encoding
                  .outputOptions("-preset medium") // Better quality encoding
                  .outputOptions("-crf 18"); // Lower CRF for better quality

                // Add audio from the overlay video (if it exists)
                finalFFmpeg
                  .outputOptions("-map 1:a?") // Map audio from the third video (if available)
                  .on("start", (command) =>
                    console.log("FFmpeg command (Final Overlay):", command)
                  )
                  .on("end", () => {
                    console.log("Final video generated successfully.");
                    console.log(
                      "Total time taken:",
                      new Date().getTime() - time,
                      "ms"
                    );
                    res.download(finalOutputPath, "final-output.mp4");
                  })
                  .on("error", (err) => {
                    console.error("Error overlaying final video:", err.message);
                    res.status(500).send("Error overlaying final video");
                  })
                  .save(finalOutputPath);
              })
              .on("error", (err) => {
                console.error(
                  "Error overlaying intermediate videos:",
                  err.message
                );
                res.status(500).send("Error overlaying intermediate videos");
              })
              .save(intermediateOutputPath);
          })
          .on("error", (err) => {
            console.error("Error generating second video:", err.message);
            res.status(500).send("Error generating second video");
          })
          .save(outputVideo2Path);
      })
      .on("error", (err) => {
        console.error("Error generating first video:", err.message);
        res.status(500).send("Error generating first video");
      })
      .save(outputVideo1Path);
  });
});
app.get("/image-to-video", exportUpload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded!" });
  }

  const imagePath = req.file.path;
  const outputVideoPath = path.join(
    path.dirname(imagePath),
    path.basename(imagePath, path.extname(imagePath)) + ".mp4"
  );

  let width = Math.round(Number(req.body.width) || 700);
  let height = Math.round(Number(req.body.height) || 394);
  const duration = Number(req.body.duration) || 10;

  // Ensure width and height are even
  width = width % 2 === 0 ? width : width + 1;
  height = height % 2 === 0 ? height : height + 1;
  const resolution = `${width}x${height}`;
  const time = new Date().getTime();

  ffmpeg()
    .input(imagePath)
    .loop(duration)
    .fps(25)
    .videoCodec("libx264")
    .size(resolution)
    .outputOptions("-pix_fmt yuv420p")
    .outputOptions("-t " + duration)
    .outputOptions("-preset medium")
    .outputOptions("-crf 18")
    .on("start", (command) => console.clear())
    .on("end", () => {
      console.log("Video generated successfully.");
      console.log(
        "Total time taken:",
        (new Date().getTime() - time) / 1000,
        "Seconds"
      );
      res.download(outputVideoPath, "output.mp4");
    })
    .on("error", (err) => {
      console.error("Error generating video:", err.message);
      res.status(500).send("Error generating video");
    })
    .save(outputVideoPath);
});
app.post("/overlay-image", (req, res) => {
  const videoPath = path.join(__dirname, "exports", "output.mp4");
  const imagePath = path.join(__dirname, "exports", "text.png");
  const outputVideoPath = path.join(path.dirname(videoPath), `output-2.mp4`);

  // Parameters
  const startTime = parseFloat(req.body.startTime) || 0; // Start time in seconds
  const endTime = parseFloat(req.body.endTime) || 10; // End time in seconds
  const x = req.body.x || 0; // X position of the overlay
  const y = req.body.y || 0; // Y position of the overlay
  const time = new Date().getTime();
  ffmpeg(videoPath)
    .input(imagePath)
    .complexFilter([
      `[1:v] format=rgba [overlay]; ` + // Preserve the original dimensions of the image
        `[0:v][overlay] overlay=${x}:${y}:enable='between(t,${startTime},${endTime})'`, // Overlay with start and end time
    ])
    .outputOptions("-c:a copy") // Preserve the original audio stream
    .on("start", (command) => console.log("FFmpeg command:", command))
    .on("end", () => {
      console.log("Overlay added successfully.");
      console.log(
        "Total time taken:",
        (new Date().getTime() - time) / 1000,
        "Seconds"
      );
      res.download(outputVideoPath, "output.mp4", (err) => {
        if (err) console.error("Error sending file:", err);
        // Clean up files (optional)
        // fs.remove(videoPath);
        // fs.remove(imagePath);
        // fs.remove(outputVideoPath);
      });
    })
    .on("error", (err) => {
      console.error("Error adding overlay:", err.message);
      res.status(500).send("Error adding overlay");
    })
    .save(outputVideoPath);
});
app.get("/overlay-video", async (req, res) => {
  const video1Path = path.join(__dirname, "exports", "output-2.mp4"); // Base video
  const video2Path = path.join(__dirname, "videos", "video_01.mp4"); // Overlay video
  const outputVideoPath = path.join(__dirname, "exports", "output.mp4"); // Output video
  console.clear();

  const hasAudio = (videoPath) => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          // Find duration and audio stream
          const duration = metadata.format.duration;
          const audio = metadata.streams.some(
            (stream) => stream.codec_type === "audio"
          );
          resolve({ audio, duration });
        }
      });
    });
  };

  if (!fs.existsSync(video1Path)) {
    return res
      .status(404)
      .send("Base video not found in the specified folder.");
  }
  if (!fs.existsSync(video2Path)) {
    return res
      .status(404)
      .send("Overlay video not found in the specified folder.");
  }

  const { x, y, width, height, overlayStartTime } = req.body;

  const [
    { audio: video1HasAudio, duration: baseDuration },
    { audio: video2HasAudio, duration: overlayDuration },
  ] = await Promise.all([hasAudio(video1Path), hasAudio(video2Path)]);

  console.log({
    video1HasAudio,
    video2HasAudio,
    baseDuration,
    overlayDuration,
  });

  // Overlay starts at the specified start time

  const complexFilter = [
    // Resize and reset the overlay video's presentation timestamp
    `[1:v] scale=${width}:${height}, setpts=PTS-STARTPTS [overlay]; ` +
      // Delay the overlay video to start at the specified start time
      `[overlay] tpad=start_duration=${overlayStartTime} [overlay_delayed]; ` +
      // Overlay the video at the specified position and time
      `[0:v][overlay_delayed] overlay=${x}:${y}:enable='between(t,${overlayStartTime},${
        overlayStartTime + overlayDuration
      })' [outv]`,
  ];

  let audioFilter = "";
  if (video1HasAudio && video2HasAudio) {
    // Both videos have audio
    audioFilter =
      `[1:a] atrim=start=0:end=${overlayDuration}, asetpts=PTS-STARTPTS, volume=1 [overlay_audio]; ` +
      `[overlay_audio] adelay=${overlayStartTime * 1000}|${
        overlayStartTime * 1000
      } [overlay_audio_delayed]; ` +
      `[0:a][overlay_audio_delayed] amix=inputs=2:duration=longest [outa]`;
  } else if (video1HasAudio) {
    // Only base video has audio
    audioFilter = `[0:a] asetpts=PTS-STARTPTS [outa]`;
  } else if (video2HasAudio) {
    // Only overlay video has audio
    audioFilter =
      `[1:a] atrim=start=0:end=${overlayDuration}, asetpts=PTS-STARTPTS, volume=1 [overlay_audio]; ` +
      `[overlay_audio] adelay=${overlayStartTime * 1000}|${
        overlayStartTime * 1000
      } [outa]`;
  } else {
    // No audio streams
    audioFilter = "";
  }

  if (audioFilter) {
    complexFilter.push(audioFilter);
  }

  console.log(complexFilter);

  const startTime = new Date().getTime();

  const outputOptions = [
    "-map [outv]", // Use the output video stream from the filter
    "-c:v libx264", // Use H.264 encoding for video
    "-preset medium", // Better quality encoding
    "-crf 18", // Lower CRF for better quality
    "-pix_fmt yuv420p", // Ensure compatibility
  ];

  // Add audio mapping and encoding only if at least one video has audio
  if (video1HasAudio || video2HasAudio) {
    outputOptions.push("-map [outa]", "-c:a aac"); // Use AAC encoding for audio
  }

  ffmpeg()
    .input(video1Path) // Base video
    .input(video2Path) // Overlay video
    .complexFilter(complexFilter)
    .outputOptions(outputOptions)
    .output(outputVideoPath)
    .on("start", (command) => {
      console.log("FFmpeg command:", command);
    })
    .on("end", () => {
      // Calculate processing time
      const endTime = new Date().getTime();
      const processingTime = (endTime - startTime) / 1000; // Convert to seconds
      console.log("Video overlayed successfully.");
      console.log(`Processing time: ${processingTime} seconds`);
      res.download(outputVideoPath, "output.mp4");
    })
    .on("error", (err) => {
      console.error("Error overlaying video:", err.message);
      res.status(500).send("Error overlaying video");
    })
    .run();
});

app.get("/generate-video", (req, res) => {
  // Get a sorted list of image files
});

app.get("/videos", async (req, res) => {
  try {
    const videosFolder = path.join(__dirname, "videos");
    const videos = fs.readdirSync(videosFolder);
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
