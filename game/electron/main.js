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

  const indexPath = path.join(__dirname, "..", "index.html");
  win.loadFile(indexPath);

  // The game never needs to leave its own packaged index.html -- block any
  // attempt to navigate away or spawn a new window/tab. Checking only for
  // the file:// scheme (rather than the exact packaged path) would still
  // let a navigation reach an arbitrary local file -- e.g. file:///etc/passwd
  // -- if some future bug ever let renderer-controlled data reach
  // location/href. Comparing the resolved path closes that off without
  // relying on that other bug never existing.
  const allowedUrl = require("node:url").pathToFileURL(indexPath).href;
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== allowedUrl) event.preventDefault();
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
