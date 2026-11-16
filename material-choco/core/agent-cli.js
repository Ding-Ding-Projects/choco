#!/usr/bin/env node
'use strict';
// Headless agent for Windows machines without the desktop app.
//   node core/agent-cli.js enroll --hub https://hub:8443 --code XXXX-XXXX [--name NAME] [--read-only] [--allow-insecure]
//   node core/agent-cli.js run
//   node core/agent-cli.js status | disconnect
const os = require('node:os');
const path = require('node:path');
const { Agent } = require('./agent');

const args = process.argv.slice(2); const cmd = args[0];
const flag = (n) => { const i = args.indexOf('--' + n); return i < 0 ? undefined : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const dataDir = process.env.MATERIAL_CHOCO_DATA || path.join(process.env.ProgramData || path.join(os.homedir(), '.config'), 'MaterialChoco');
const agent = new Agent({ configFile: path.join(dataDir, 'agent.json'), policy: { chocoPath: flag('choco') === true ? undefined : flag('choco') } });

(async () => {
  if (cmd === 'enroll') {
    const s = await agent.enroll({ hubUrl: flag('hub'), code: flag('code'), name: flag('name') === true ? undefined : flag('name'), readOnly: !!flag('read-only'), allowInsecure: !!flag('allow-insecure') });
    console.log(`Enrolled as machine ${s.machineId} with ${s.hubUrl}. Start the agent with: node core/agent-cli.js run`);
  } else if (cmd === 'run') {
    if (!agent.config) { console.error('Not enrolled. Run the enroll command first.'); process.exit(2); }
    agent.on('state', (s) => console.log(new Date().toISOString(), s.state, s.lastError || ''));
    agent.start();
  } else if (cmd === 'status') { console.log(JSON.stringify(agent.status(), null, 1)); }
  else if (cmd === 'disconnect') { agent.disconnect(); console.log('Disconnected. The hub still lists this machine until you remove it there.'); }
  else { console.log('Usage: agent-cli.js enroll --hub URL --code CODE [--name NAME] [--read-only] [--allow-insecure] | run | status | disconnect'); process.exit(cmd ? 2 : 0); }
})().catch((e) => { console.error(e.message); process.exit(1); });
