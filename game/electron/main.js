const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#060a12",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "..", "index.html"));

  // The game never needs to leave its own packaged files -- block any
  // attempt to navigate away or spawn a new window/tab.
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on("app:quit", () => app.quit());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
