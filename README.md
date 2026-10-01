# 鳥信工坊 v0.3

原創正體中文文字工坊遊戲。你是溪岸工坊的學徒，做合用的物品，聽熟客的需求，讓鳥信帶回物品的故事。無玩家戰鬥，製作必定成功，沒有倒數或每日限額。

## 啟動

Git repository：`https://github.com/ml0427/birdsong-workshop`

雙擊 `START.cmd`。會啟動本機伺服器並打開瀏覽器：

**http://127.0.0.1:4317**

也可用 PowerShell：

```powershell
Set-Location -LiteralPath './birdsong-workshop'
node server.cjs --open
```

保留伺服器視窗即可遊玩；按 Ctrl+C 停止。只綁定 127.0.0.1，不對外公開。無須 `npm install`。Node.js 22 以上可用；已在本機 Node.js v24.11.0 驗證。

若 4317 已有本遊戲，直接開網址；若被其他程式使用，可在 PowerShell 設定 `$env:PORT='4318'` 後啟動。但瀏覽器存檔跟網址綁定，換連接埠請先匯出備份。

`index.html` 也能直接用瀏覽器開啟作為備用入口；建議固定使用上方本機網址，避免不同瀏覽器的 file 存檔行為差異。

## 第一筆生意

1. 用木頭 1 做木杖，用鐵 1 做鐵劍。現在仍是準備月 0。
2. 開店進入第 1 月，詢問阿岑用途，把兩件都推薦給他。
3. 委託阿岑採購，建議先訂銅 1；也可多訂木頭與鐵。
4. 關店，再開店。材料與鳥信一起到來，小禾第一次需要銅澆水壺。
5. 製作、鑑定、推薦，繼續接受新需求。製作經驗與聲望解鎖銀燈、金鈴。

提早關店不會結算、換月或清除需求，下次開店繼續。生活費與採購不足可記欠款，銷售先還款，不會結束遊戲。

## 已完成內容

- 3 位固定角色、6 種配方、5 種簡單材料、3 種品質。
- 製作、逐位來客對話與合用推薦、持有權移轉、採購與下月交付（由開店觸發）。
- 技能成長、單件鑑定、人物信任與故事、聲望金鈴委託。
- NPC 使用鳥信、退役贈還、舊物再售、熔鍊／拆解與單次材料傳承。
- 收藏簿保存每一件作品的製作、交易、使用、贈還及熔鍊歷史。
- 本機自動保存、上一筆備份復原、匯出 JSON、驗證後匯入、重新開始確認。
- 桌面與手機版、原創內嵌 SVG、鍵盤焦點與本機字型。無網路資產。

## 存檔

每次有效操作即自動保存。從「保存」頁選「匯出 JSON 備份」下載，再用「匯入備份」還原。匯入先驗證再確認，壞檔不覆蓋目前進度。主存檔損壞時嘗試上一筆備份。

使用同一台電腦、同一瀏覽器、同一網址。清除瀏覽器資料或使用無痕模式會影響保存，建議定期匯出。兩個視窗更新會同步，舊畫面操作先拒絕以避免重複交易。

## 開發與驗證

```powershell
node --test tests/engine.test.cjs
node scripts/build.cjs
node tests/browser.cjs
```

也提供 `npm test`、`npm run build`、`npm run test:ui`、`npm start`。沒有套件依賴，可直接使用 Node 指令。

瀏覽器測試使用本機已存在的 Chromium headless shell，以獨立測試資料夾執行，不更動玩家瀏覽器進度。可用環境變數 `CHROME_PATH` 指定其他 Chromium 路徑。測試會暫開 4328 本機連接埠並在結束時停止。

實測紀錄見 `TEST_RESULTS.md`。Git 不含 QA 產物或存檔；自行執行瀏覽器測試會在被忽略的 `qa` 目錄產生報告、畫面與測試存檔，不使用玩家瀏覽器進度。

## 初版範圍

目前為小規模循環：人物與月情報較少，需求會重複，經濟未做精細平衡。鑑定技能先記錄經驗，品質由製作經驗與傳承決定。沒有章節、多結局、大型博物館、音效、雲端存檔或公開部署。

完整規則與可調整數值在 `SPEC.md`。核心資料在 `engine.js`，介面在 `app.js`、`style.css`，無建置套件依賴。

## 雲端／Linux QA

```sh
git clone https://github.com/ml0427/birdsong-workshop.git
cd birdsong-workshop
node --test tests/engine.test.cjs
node server.cjs
```

伺服器只監聽 127.0.0.1:4317。使用執行環境提供的本機瀏覽器或預覽連接，不需要 GitHub Pages 或公開部署。Linux 請使用 `node server.cjs`，省略 Windows 自動開啟瀏覽器的 `--open`。

若環境已有 Chromium，可指定可執行檔運行隔離介面測試：

```sh
CHROME_PATH=/absolute/path/to/chromium node tests/browser.cjs
```

不要將新的 QA JSON 存檔、瀏覽器資料或秘密提交到 Git。
