const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  expandWindow: () => ipcRenderer.send('expand-window'),
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  isRobloxRunning: () => new Promise((resolve) => {
    ipcRenderer.once('roblox-running-result', (event, running) => {
      resolve(running);
    });
    ipcRenderer.send('check-roblox-running');
  }),
  onUpdatePrompt: (callback) => ipcRenderer.on('show-update-prompt', callback),
  sendPrereleaseChoice: (accepted, url) => ipcRenderer.send('prerelease-update-choice', accepted, url)
});
