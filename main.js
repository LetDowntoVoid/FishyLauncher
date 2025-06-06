const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { Menu } = require('electron');
Menu.setApplicationMenu(Menu.buildFromTemplate([]));


let win;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
    show: false,
  });

  win.loadFile('index.html');

  win.webContents.on('devtools-opened', () => {
    win.webContents.closeDevTools();
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  ipcMain.on('expand-window', () => {
    win.maximize();
  });

  ipcMain.on('minimize-window', () => {
    win.minimize();
  });

  ipcMain.on('close-window', () => {
    win.close();
  });

  ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
  });

  ipcMain.on('check-roblox-running', (event) => {
    exec('tasklist', (err, stdout) => {
      if (err) {
        event.reply('roblox-running-result', false);
        return;
      }
      const isRunning = /Roblox(PlayerBeta)?\.exe/i.test(stdout);
      event.reply('roblox-running-result', isRunning);
    });
  });
}

app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-features', 'ElectronEnableWebSQL,ElectronSerialService');
app.commandLine.appendSwitch('disable-dev-tools');
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
