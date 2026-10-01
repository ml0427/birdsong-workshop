'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const info = { version: 'v' + pkg.version.split('.').slice(0, 2).join('.'), builtAt: new Date().toISOString(), schema: 1 };
fs.writeFileSync(path.join(root, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
module.exports = info;
