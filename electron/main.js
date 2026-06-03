'use strict';

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// De server slaat instellingen (o.a. Discogs-token) op in de userData-map,
// zodat ze een her-installatie/update overleven.
process.env.APP_CONFIG_DIR = app.getPath('userData');

// De server is TypeScript en wordt gecompileerd naar dist/server/.
const { start } = require('../dist/server/app');

let mainWindow = null;
let serverPort = null;

// Zorg dat er maar één instantie draait (de server claimt anders een poort).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 640,
    minHeight: 560,
    title: 'Playlist Downloader',
    backgroundColor: '#0e0e12',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Eenvoudig menu: alleen verversen + sluiten + externe links.
  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Externe links (YouTube) openen in de standaardbrowser i.p.v. in de app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const { port } = await start(0); // poort 0 = vrije poort door OS gekozen
    serverPort = port;
    createWindow();
  } catch (err) {
    const { dialog } = require('electron');
    dialog.showErrorBox('Opstartfout', `De interne server kon niet starten:\n\n${err.message}`);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
