// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("yt", {
  getVideoInfo: (url) => ipcRenderer.invoke("get-video-info", url),
  downloadVideo: (options) => ipcRenderer.invoke("download-video", options),
  loadHistory: () => ipcRenderer.invoke("load-history"),
  saveHistory: (history) => ipcRenderer.send("save-history", history),
  clearHistory: () => ipcRenderer.invoke("clear-history"),
});
