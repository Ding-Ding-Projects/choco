'use strict';
// Puts the stand-in for choco.exe (fake-choco.js) into a bundle folder, under the file name the app
// looks for on this platform. Linux starts the script through its first line. Windows cannot start a
// script directly, so MATERIAL_CHOCO_CLI_NODE tells the wrapper to run it with Node; the app never
// sets that variable. Child processes inherit it with the rest of the environment.
const fs = require('node:fs');
const path = require('node:path');

function installStandIn(bundle) {
  fs.mkdirSync(bundle, { recursive: true });
  const exe = path.join(bundle, process.platform === 'win32' ? 'choco.exe' : 'choco');
  fs.copyFileSync(path.join(__dirname, 'fake-choco.js'), exe);
  if (process.platform === 'win32') process.env.MATERIAL_CHOCO_CLI_NODE = '1'; else fs.chmodSync(exe, 0o755);
  return exe;
}
module.exports = { installStandIn };
