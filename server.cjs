'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const port = Number(process.env.PORT || 4317);
const root = __dirname;
const allowed = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']], ['/engine.js', ['engine.js', 'text/javascript']],
  ['/app.js', ['app.js', 'text/javascript']], ['/content.js', ['content.js', 'text/javascript']], ['/build-info.json', ['build-info.json', 'application/json']]
]);
const server = http.createServer((req, res) => {
  const entry = allowed.get(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
  if (!entry || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const data = fs.readFileSync(path.join(root, entry[0]));
    res.writeHead(200, { 'Content-Type': entry[1] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) { res.writeHead(500); res.end('Local file missing'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `連接埠 ${port} 已使用。若工坊已啟動，請開啟 http://127.0.0.1:${port} 。或設定 PORT 使用其他連接埠。` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`鳥信工坊已啟動：${url}\n檔案：${root}\n按 Ctrl+C 停止。僅接受本機連線。`);
  if (process.argv.includes('--open')) execFile('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`], { windowsHide: true }, error => { if (error) console.log(`請自行在瀏覽器開啟 ${url}`); });
});
