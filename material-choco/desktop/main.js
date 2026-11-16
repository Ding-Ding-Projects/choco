'use strict';
// Material Choco desktop app. Runs the same hub in-process on 127.0.0.1 with "This PC" as a
// built-in machine, and can also act as an agent for a remote hub.
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

// Headless agent mode: MaterialChoco.exe --agent enroll|run|status|disconnect ...
const agentAt = process.argv.indexOf('--agent');
if (agentAt >= 0) {
  process.argv = [process.argv[0], __filename, ...process.argv.slice(agentAt + 1)];
  require('../core/agent-cli.js');
} else {
  const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
  const { createHub } = require('../hub/server');
  const { Agent } = require('../core/agent');
  const choco = require('../core/choco');

  // Squirrel.Windows install, update and uninstall events: create or remove shortcuts, then quit.
  const squirrel = process.argv.find((a) => a.startsWith('--squirrel-'));
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  if (squirrel && process.platform === 'win32') {
    const exe = path.basename(process.execPath);
    const run = (args) => { try { spawn(updateExe, args, { detached: true }).on('close', () => app.quit()); } catch { app.quit(); } };
    if (squirrel === '--squirrel-install' || squirrel === '--squirrel-updated') run(['--createShortcut', exe]);
    else if (squirrel === '--squirrel-uninstall') run(['--removeShortcut', exe]);
    else app.quit();
  } else if (!app.requestSingleInstanceLock()) { app.quit(); } else {
    let win = null; let hub = null; let agent = null;
    const dataDir = path.join(app.getPath('userData'), 'data');

    async function start() {
      Menu.setApplicationMenu(null);
      hub = createHub({ dataDir, desktop: true, host: '127.0.0.1', port: 0 });
      const addr = await hub.listen();
      agent = new Agent({ configFile: path.join(dataDir, 'agent.json') }); agent.start();
      win = new BrowserWindow({ width: 1360, height: 900, minWidth: 420, minHeight: 560, frame: false, backgroundColor: '#FCF8F6', show: false, title: 'Material Choco', icon: path.join(__dirname, 'icon.png'),
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
      const origin = `http://127.0.0.1:${addr.port}`;
      // The window only ever shows the local UI. Everything else opens in the default browser.
      win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
      win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(origin + '/')) e.preventDefault(); });
      win.once('ready-to-show', () => win.show());
      await win.loadURL(`${origin}/?launch=${hub.launchToken}`);
      hub.createJob(hub.db.machines.find((m) => m.local), { kind: 'inventory' }, 'startup');
      if (process.env.MATERIAL_CHOCO_SCREENSHOT) setTimeout(async () => { fs.writeFileSync(process.env.MATERIAL_CHOCO_SCREENSHOT, (await win.webContents.capturePage()).toPNG()); app.quit(); }, 6000);
    }

    const fromUi = (e) => win && e.sender === win.webContents;
    ipcMain.handle('win', (e, action) => { if (!fromUi(e)) return; if (action === 'minimize') win.minimize(); else if (action === 'maximize') (win.isMaximized() ? win.unmaximize() : win.maximize()); else if (action === 'close') win.close(); });
    ipcMain.handle('elevated', (e) => fromUi(e) && choco.isElevated());
    ipcMain.handle('relaunch-elevated', (e) => {
      if (!fromUi(e) || process.platform !== 'win32') return { error: 'Only available on Windows' };
      // Windows shows its own consent prompt; the person at the keyboard approves it.
      const child = spawn('powershell.exe', ['-NoProfile', '-Command', 'Start-Process', '-FilePath', `'${process.execPath.replace(/'/g, "''")}'`, '-Verb', 'RunAs'], { detached: true, stdio: 'ignore', windowsHide: true });
      child.on('exit', (code) => { if (code === 0) app.quit(); }); return { ok: true };
    });
    ipcMain.handle('agent-status', (e) => fromUi(e) && agent.status());
    ipcMain.handle('agent-connect', async (e, o) => { if (!fromUi(e)) return { error: 'refused' }; try { await agent.enroll({ hubUrl: String(o.hubUrl || ''), code: String(o.code || ''), allowInsecure: !!o.allowInsecure, readOnly: !!o.readOnly, name: os.hostname() }); agent.start(); return agent.status(); } catch (err) { return { error: err.message }; } });
    ipcMain.handle('agent-disconnect', (e) => { if (!fromUi(e)) return; agent.disconnect(); return agent.status(); });
    ipcMain.handle('open-data', (e) => fromUi(e) && shell.openPath(app.getPath('userData')));
    ipcMain.handle('open-external', (e, url) => { if (fromUi(e) && /^https?:\/\//.test(String(url))) shell.openExternal(String(url)); });

    app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
    app.on('window-all-closed', async () => { if (agent) agent.stop(); if (hub) await hub.close(); app.quit(); });
    app.whenReady().then(start).catch((err) => { console.error(err); app.quit(); });
  }
}
