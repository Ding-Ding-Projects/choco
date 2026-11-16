'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  win: (action) => ipcRenderer.invoke('win', action),
  elevated: () => ipcRenderer.invoke('elevated'),
  relaunchElevated: () => ipcRenderer.invoke('relaunch-elevated'),
  openData: () => ipcRenderer.invoke('open-data'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onUpdate: (fn) => ipcRenderer.on('update-state', (_e, u) => fn(u)),
  restartToUpdate: () => ipcRenderer.invoke('restart-to-update'),
  agent: { status: () => ipcRenderer.invoke('agent-status'), connect: (o) => ipcRenderer.invoke('agent-connect', o), disconnect: () => ipcRenderer.invoke('agent-disconnect') },
});
