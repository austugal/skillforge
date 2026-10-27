'use strict';
const {execFileSync} = require('node:child_process');
const {readdirSync} = require('node:fs');
for (const folder of ['src','extension','scripts','test']) for (const file of readdirSync(folder)) if (/\.(?:js|cjs)$/.test(file)) execFileSync(process.execPath, ['--check', `${folder}/${file}`], {stdio:'inherit'});
console.log('All JavaScript syntax checks passed.');
