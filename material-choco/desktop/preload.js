'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  win: (action) => ipcRenderer.invoke('win', action),
  elevated: () => ipcRenderer.invoke('elevated'),
  relaunchElevated: () => ipcRenderer.invoke('relaunch-elevated'),
  openData: () => ipcRenderer.invoke('open-data'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  agent: { status: () => ipcRenderer.invoke('agent-status'), connect: (o) => ipcRenderer.invoke('agent-connect', o), disconnect: () => ipcRenderer.invoke('agent-disconnect') },
});
