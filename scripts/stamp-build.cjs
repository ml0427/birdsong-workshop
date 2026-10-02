'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const info = { version: 'v' + pkg.version.split('.').slice(0, 2).join('.'), builtAt: new Date().toISOString(), schema: require('../engine.js').initialState().schema };
fs.writeFileSync(path.join(root, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
// Keep all browser asset URLs in sync; old URLs can preserve stale scripts on Pages.
for(const name of ['index.html','lab.html']){
 const file=path.join(root,name);
 if(fs.existsSync(file))fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\?v=\d+\.\d+/g,'?v='+info.version.slice(1)).replace(/(<span id="version">)v\d+\.\d+(<\/span>)/g,'$1'+info.version+'$2'));
}
module.exports = info;
