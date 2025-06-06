const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { Menu } = require('electron');
const https = require('https');
const { autoUpdater } = require("electron-updater");
Menu.setApplicationMenu(Menu.buildFromTemplate([]));

const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const CURRENT_VERSION = packageJson.version;
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

  checkForUpdates(async (latest) => {
    if (!latest) {
      console.log("FishyLauncher: No update info found.");
      win.loadFile('index.html');
      return;
    }
    const latestVersion = latest.tag_name;
    const isPrerelease = latest.prerelease;
    const isDraft = latest.draft;
    const isNewer = compareVersions(latestVersion, CURRENT_VERSION) > 0;

    console.log(`FishyLauncher: Latest release found: ${latestVersion} (${isPrerelease ? "Prerelease" : "Production"}) - ${latest.html_url}`);

    // Helper to get first installer asset
    function getInstallerAsset(release) {
      if (!release.assets) return null;
      return release.assets.find(asset =>
        asset.name.match(/\.(exe|msi|zip)$/i)
      );
    }

    if (isNewer && !isDraft) {
      if (!isPrerelease) {
        // Production: force update, open installer asset if available
        const asset = getInstallerAsset(latest);
        if (asset) {
          console.log(`FishyLauncher: Downloading installer: ${asset.browser_download_url}`);
          shell.openExternal(asset.browser_download_url);
        } else {
          shell.openExternal(latest.html_url);
        }
        app.quit();
      } else {
        // Prerelease: load UI, then prompt via IPC
        win.loadFile('index.html');
        win.once('ready-to-show', () => {
          win.show();
          win.webContents.send('show-update-prompt', {
            version: latestVersion,
            url: latest.html_url,
            asset: getInstallerAsset(latest)?.browser_download_url || latest.html_url
          });
        });
      }
    } else {
      win.loadFile('index.html');
    }
  });

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

  // Listen for user's prerelease update choice from renderer
  ipcMain.on('prerelease-update-choice', (event, accepted, url) => {
    if (accepted) {
      shell.openExternal(url);
      app.quit();
    }
  });
}

function checkForUpdates(callback) {
  const options = {
    hostname: 'api.github.com',
    path: '/repos/LetDowntoVoid/FishyLauncher/releases',
    headers: { 'User-Agent': 'FishyLauncher' }
  };
  https.get(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const releases = JSON.parse(data);
        if (!Array.isArray(releases) || releases.length === 0) return callback(null);
        // Find the latest non-draft release by published_at date
        const latest = releases
          .filter(r => !r.draft)
          .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];
        callback(latest || null);
      } catch (e) {
        callback(null);
      }
    });
  }).on('error', () => callback(null));
}

function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split(/[\.-]/).map(x => isNaN(x) ? x : Number(x));
  const pb = b.replace(/^v/, '').split(/[\.-]/).map(x => isNaN(x) ? x : Number(x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-features', 'ElectronEnableWebSQL,ElectronSerialService');
app.commandLine.appendSwitch('disable-dev-tools');
app.whenReady().then(createWindow);

app.on('ready', () => {
  createWindow();

  // Check for updates and notify
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    console.log('Update available. Downloading...');
    // Optionally, notify the user in your UI
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded. Will install on quit.');
    // Optionally, prompt the user to restart now:
    // autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater error:', err);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
