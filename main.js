const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const historyPath = path.join(app.getPath("userData"), "downloads.json");

const isWindows = process.platform === "win32";
const isArm = process.arch === "arm64";
const isDev = !app.isPackaged;

const basePath = isDev ? __dirname : process.resourcesPath;

const ytDlpPath = isWindows
  ? path.join(basePath, "tools", "yt-dlp.exe")
  : isArm
  ? path.join(basePath, "tools", "yt-dlp-arm64")
  : path.join(basePath, "tools", "yt-dlp-x64");

const ffmpegPath = isWindows
  ? path.join(basePath, "tools", "ffmpeg.exe")
  : isArm
  ? path.join(basePath, "tools", "ffmpeg-arm64")
  : path.join(basePath, "tools", "ffmpeg-x64");

process.env.FFMPEG_PATH = ffmpegPath;

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    frame: false,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  win.loadFile("index.html");

  if (isDev) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

// 📦 Get video metadata
ipcMain.handle("get-video-info", async (event, url) => {
  return new Promise((resolve) => {
    execFile(
      ytDlpPath,
      ["--dump-single-json", url],
      (error, stdout, stderr) => {
        if (error) {
          console.error("yt-dlp error:", stderr || error.message);
          return resolve(null);
        }

        try {
          const result = JSON.parse(stdout);

          const audioTracks = result.formats
            .filter((f) => f.vcodec === "none" && f.acodec !== "none")
            .map((f) => ({
              format_id: f.format_id,
              language: f.language || "unknown",
              ext: f.ext,
              abr: f.abr,
              label: `${f.language || "unknown"} (${f.abr}kbps ${f.ext})`,
            }));

          const uniqueTracks = [];
          const seen = new Set();

          for (const track of audioTracks) {
            const key = `${track.language}-${track.abr}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueTracks.push(track);
            }
          }

          resolve({
            title: result.title,
            thumbnail: result.thumbnail,
            audioTracks: uniqueTracks,
          });
        } catch (err) {
          console.error("Failed to parse yt-dlp output:", err);
          resolve(null);
        }
      }
    );
  });
});

// 💾 Download handler
ipcMain.handle("download-video", async (event, { url, format, audioTrack }) => {
  try {
    const info = await new Promise((resolve, reject) => {
      execFile(ytDlpPath, ["--dump-single-json", url], (err, stdout) => {
        if (err) return reject(err);
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(e);
        }
      });
    });

    const title = info.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `${title}.${format}`,
    });

    if (!filePath) return;

    const args =
      format === "mp3"
        ? [
            "-f",
            audioTrack || "bestaudio",
            "--extract-audio",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "--prefer-free-formats",
            "--no-playlist",
            "--ffmpeg-location",
            ffmpegPath,
            "-o",
            filePath,
            url,
          ]
        : [
            "-f",
            "bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a][acodec^=mp4a]/mp4",
            "--merge-output-format",
            "mp4",
            "--remux-video",
            "mp4",
            "--prefer-free-formats",
            "--no-playlist",
            "--ffmpeg-location",
            ffmpegPath,
            "-o",
            filePath,
            url,
          ];

    console.log("yt-dlp args:", args);

    await new Promise((resolve, reject) => {
      execFile(ytDlpPath, args, (err, stdout, stderr) => {
        if (err) {
          console.error("Download error:", stderr || err.message);
          return reject(err);
        }
        resolve();
      });
    });

    const isValid =
      fs.existsSync(filePath) && fs.statSync(filePath).size > 10000;
    if (!isValid) {
      throw new Error("Downloaded file appears to be corrupted or too small.");
    }

    return {
      filename: path.basename(filePath),
      fullPath: filePath,
    };
  } catch (err) {
    console.error("Download failed:", err.message || err);
    throw err;
  }
});

// History
ipcMain.handle("load-history", () => {
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    }
    return [];
  } catch (err) {
    console.error("Failed to load history:", err);
    return [];
  }
});

ipcMain.on("save-history", (event, history) => {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save history:", err);
  }
});

ipcMain.handle("clear-history", () => {
  try {
    if (fs.existsSync(historyPath)) {
      fs.unlinkSync(historyPath);
    }
    return true;
  } catch (err) {
    console.error("Failed to clear history:", err);
    return false;
  }
});

if (process.platform === "darwin") {
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on("window-all-closed", () => {
    // Don't quit on macOS when all windows are closed
    // App remains in the dock until Cmd+Q or app.quit()
  });
} else {
  // On Windows/Linux: Quit when all windows are closed
  app.on("window-all-closed", () => {
    app.quit();
  });
}
