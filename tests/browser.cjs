'use strict';
// Dependency-free Chromium DevTools UI checks. No external services or packages.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const W = require('../engine.js');
const root = path.resolve(__dirname, '..'), qa = path.join(root, 'qa');
const port = Number(process.env.QA_PORT || 4328);
const gameUrl = process.env.GAME_URL || `http://127.0.0.1:${port}`;
const chrome = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || path.join(require('node:os').homedir(), 'AppData', 'Local'), 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const profile = path.join(qa, 'browser-profile', `run-${Date.now()}`);
const delay = ms => new Promise(r => setTimeout(r, ms));
const reports = [], exceptions = [];
let browser, server, socket;
async function waitUntil(fn, description, ms = 10000) {
  const until = Date.now() + ms;
  do { if (await fn()) return; await delay(75); } while (Date.now() < until);
  throw new Error('Timed out: ' + description);
}
function pass(name) { reports.push(name); console.log('PASS ' + name); }
async function main() {
  fs.mkdirSync(profile, { recursive: true });
  if (!process.env.GAME_URL) {
    server = spawn(process.execPath, ['server.cjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: 'ignore' });
    await waitUntil(async () => { try { return (await fetch(gameUrl)).ok; } catch (e) { return false; } }, 'local server');
    const blocked = await fetch(`http://127.0.0.1:${port}/SPEC.md`); assert.equal(blocked.status, 404);
  }
  const browserLog = fs.openSync(path.join(qa, 'chromium.log'), 'w');
  browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', browserLog] });
  const activePort = path.join(profile, 'DevToolsActivePort');
  await waitUntil(() => fs.existsSync(activePort), 'Chromium debugging endpoint', 15000);
  const debugPort = fs.readFileSync(activePort, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let seq = 0; const pending = new Map();
  socket.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); if (!p) return; pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.text + ' ' + JSON.stringify(m.params.exceptionDetails.exception));
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const ready = async () => { await delay(200); await waitUntil(() => evaluate('document.readyState === "complete" && !!window.Workshop && !!document.getElementById("app")?.children.length && document.querySelectorAll("[data-tab]").length >= 3'), 'game render'); };
  const snapshot = () => evaluate('JSON.parse(localStorage.getItem("birdsong-workshop-save-v1") || JSON.stringify({state: Workshop.initialState()})).state');
  const clickAction = async (type, properties = {}, twice = false) => {
    const found = await evaluate(`(() => { const el = [...document.querySelectorAll('[data-action]')].find(b => { const a = JSON.parse(b.dataset.action); return a.type === ${JSON.stringify(type)} && Object.entries(${JSON.stringify(properties)}).every(([k,v]) => a[k] === v); }); if (!el || el.disabled) return false; el.click(); ${twice ? 'el.click();' : ''} return true; })()`);
    assert(found, 'button available: ' + type + JSON.stringify(properties)); await delay(30);
  };
  const clickTab = async tab => { assert(await evaluate(`(() => { const el = document.querySelector('[data-tab="${tab}"]'); if(!el) return false; el.click(); return true; })()`), 'tab ' + tab); };
  const screenshot = async name => { const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(qa, name), Buffer.from(data, 'base64')); };
  const desktopChecks = async (phase, buttons = []) => {
    for (const [width, height] of [[1280, 720], [1366, 768], [1920, 1080]]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      const geometry = await evaluate(`(() => { const selectors=${JSON.stringify(buttons)}; return { page:document.documentElement.scrollHeight, viewport:innerHeight, width:document.documentElement.scrollWidth, innerWidth, overflow:getComputedStyle(document.body).overflowY, controls:selectors.map(selector=>{const b=document.querySelector(selector); if(!b) return {selector,missing:true}; const r=b.getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,hit:!!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')};})}; })()`);
      assert(geometry.page <= height + 1, `${phase} ${width}x${height}: whole-page scroll (${geometry.page})`);
      assert(geometry.width <= width, `${phase}: horizontal overflow`);
      assert.notEqual(geometry.overflow, 'hidden', 'page overflow must not hide controls');
      for (const control of geometry.controls) assert(!control.missing && control.x >= 0 && control.y >= 0 && control.right <= width + 1 && control.bottom <= height + 1 && control.height >= 44 && control.hit, JSON.stringify(control));
      await screenshot(`desktop-${phase}-${width}x${height}.png`);
    }
    pass(`${phase}：1280×720、1366×768、1920×1080 無整頁捲動，主要按鈕可見可點`);
  };
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: gameUrl }); await ready();
  await evaluate('localStorage.clear(); location.reload()'); await ready();

  assert.equal(await evaluate('document.documentElement.lang'), 'zh-Hant');
  assert(await evaluate('document.getElementById("version").textContent.includes("v0.7")'));
  assert.equal((await snapshot()).materials.木頭,3);
  assert(await evaluate('!!document.querySelector(".door-only #door") && !document.querySelector(".visitor")'));
  assert(!await evaluate('document.body.innerText.includes("銅")'));
  await desktopChecks('opening',['[data-action*=staff]','[data-action*=sword]','[data-action*=open]']);
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));await screenshot('mobile-v07-opening.png');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await clickAction('craft',{recipe:'staff'});await clickAction('craft',{recipe:'sword'});
  assert.equal(W.inventory(await snapshot()).length,0);assert.equal((await snapshot()).month,0);
  const manufacturing=await snapshot();await cdp('Page.reload');await ready();assert.deepEqual(await snapshot(),manufacturing);
  await clickAction('open',{},true);assert.equal((await snapshot()).month,1);assert.equal(W.inventory(await snapshot()).length,2);
  await clickAction('talk');await clickAction('sell',{itemId:'item-1'});await clickAction('sell',{itemId:'item-2'});
  await clickTab('purchase');assert(!await evaluate('!!document.querySelector("option[value=銅]")'));
  await clickAction('explore',{},true);assert.equal((await snapshot()).explorations.length,1);
  await clickAction('leave');await clickAction('close');assert(await evaluate('!!document.querySelector(".door-only #door") && !document.querySelector(".visitor")'));
  await clickAction('open');assert.equal((await snapshot()).materials.銅,2);await clickAction('talk');
  await clickAction('accept-commission',{},true);assert.equal((await snapshot()).commissions[0].status,'crafting');
  await clickTab('craft');await screenshot('production-v07.png');await clickAction('close');await clickAction('open');
  const seek=async npc=>{while(W.activeVisit(await snapshot())?.npc!==npc){const v=W.activeVisit(await snapshot());assert(v);await clickAction(v.phase==='service'?'leave':'decline');}};
  await seek('he');assert.equal(W.activeVisit(await snapshot()).kind,'delivery');
  await desktopChecks('delivery',['.counter [data-action*=deliver]','[data-action*=close]']);
  const c=(await snapshot()).commissions[0];await clickTab('inventory');await clickAction('appraise',{itemId:c.itemId});
  await clickAction('deliver',{itemId:c.itemId},true);let s=await snapshot();assert.equal(s.items[c.itemId].owner,'he');assert.equal(s.items[c.itemId].episodes[0].uses,0);
  pass('月份製作、材料探索、單一人物委託、指定成品交付、去重與重載');
  await clickTab('settings');
  await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: qa });
  await evaluate('document.querySelector("[data-tool=export]").click()');
  const download = path.join(qa, `鳥信工坊-第${s.month}月.json`);
  await waitUntil(() => fs.existsSync(download), 'exported backup');
  const exported = W.importSave(fs.readFileSync(download, 'utf8')); assert.deepEqual(exported, s);
  await evaluate('document.querySelector("[data-tool=new]").click()'); assert(await evaluate('document.getElementById("confirm-dialog").open'));
  await evaluate('document.getElementById("confirm-yes").click()'); await delay(50); assert.equal((await snapshot()).month, 0);
  await clickTab('settings');
  const doc = await cdp('DOM.getDocument'); const input = await cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#import-file' });
  await cdp('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [download] });
  await waitUntil(() => evaluate('document.getElementById("confirm-dialog").open'), 'import confirmation');
  await evaluate('document.getElementById("confirm-yes").click()'); await delay(50); assert.deepEqual(await snapshot(), s);
  const badFile = path.join(qa, 'invalid-save.json'); fs.writeFileSync(badFile, '{bad');
  await cdp('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [badFile] }); await delay(75); assert.deepEqual(await snapshot(), s);
  assert(await evaluate('document.getElementById("notice").textContent.includes("匯入失敗")'));
  pass('真正下載 JSON、重新開始確認、檔案選擇匯入及壞檔拒絕；進度完整保留');

  await clickAction('close');await clickAction('open');s=await snapshot();assert.equal(s.items[c.itemId].episodes[0].uses,1);
  await seek('cen');await clickAction('reclaim',{itemId:'item-1'});await clickTab('inventory');await clickAction('smelt',{itemId:'item-1'});
  assert(await evaluate('document.getElementById("confirm-dialog").open'));await evaluate('document.getElementById("confirm-yes").click()');await delay(50);
  await clickTab('collection');assert(await evaluate('document.getElementById("panel").innerText.includes("實物已消耗")'));
  await screenshot('collection-v07.png');await desktopChecks('collection',['[data-tab=craft]','[data-tab=collection]']);
  const saved=await snapshot();await cdp('Page.reload');await ready();assert.deepEqual(await snapshot(),saved);
  assert.equal(exceptions.length,0);pass('實際使用才磨耗、本人贈還與熔鍊收藏、無未處理例外');
  const result = { status: 'passed', checks: reports, exceptions, month: (await snapshot()).month, browser: chrome, gameUrl, isolatedProfile: true, screenshots: fs.readdirSync(qa).filter(n => n.endsWith('.png')), finishedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(qa, 'browser-report.json'), JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); fs.mkdirSync(qa, { recursive: true }); fs.writeFileSync(path.join(qa, 'browser-report.json'), JSON.stringify({ status: 'failed', checks: reports, exceptions, error: error.stack }, null, 2)); process.exitCode = 1; }).finally(async () => {
  if (socket) socket.close(); if (browser) browser.kill(); if (server) server.kill();
});
