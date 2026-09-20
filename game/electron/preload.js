const { contextBridge, ipcRenderer } = require("electron");

// Minimal, read-only-plus-one-signal bridge: the renderer can tell it's
// running inside the desktop build (to show a Quit button) and can ask
// the main process to quit. No data ever flows the other way.
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  quit: () => ipcRenderer.send("app:quit"),
});
