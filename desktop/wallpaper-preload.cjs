'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('albumWallpaper', Object.freeze({
  getSnapshot: () => ipcRenderer.invoke('wallpaper:snapshot'),
  onSnapshot: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('wallpaper:update', listener);
    return () => ipcRenderer.removeListener('wallpaper:update', listener);
  }
}));
