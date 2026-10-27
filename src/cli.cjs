#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');
const {normalize, validate} = require('./core.cjs');
const {Store} = require('./storage.cjs');
async function main() {
  const [command, file, folder, target = 'generic'] = process.argv.slice(2);
  if (!['lint','export'].includes(command) || !file || command === 'export' && !folder) throw Error('Usage: node src/cli.cjs lint session.json | export session.json output-folder [generic|copilot|claude|codex]');
  if ((await fs.stat(file)).size > 2000000) throw Error('Session exceeds the 2 MB import limit.');
  const s = normalize(JSON.parse(await fs.readFile(file, 'utf8'))), report = validate(s);
  if (command === 'lint') {console.log(JSON.stringify(report,null,2)); process.exitCode = report.ok ? 0 : 1;}
  else {console.log(await new Store('').export(s,target,folder));}
}
main().catch(e => {console.error(e.message); process.exitCode = 1;});
