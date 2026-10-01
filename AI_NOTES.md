# 專案筆記

v0.5、存檔 schema 2。純 HTML/CSS/JavaScript 與 Node 靜態伺服器，無依賴。規則見 SPEC.md。

engine.js 以 dispatch 原子修改。所有 NPC 動作需當前 visit ID 和 counterId；成交後 service 留人，leave 才換人，close 完成 service，但開場未採購必保留。每次 open 更新月 counter token，未完成 request 跨月。

六類皆為裝備。traits 為 light/solid/guard，效能推導、不重複存欄位；durability、maxDurability、repaired 實存。episodes 是每段持有期使用證據；usedEvent 只為遷移兼容，不能拿來阻止新持有者使用。故事需較早首次使用月。退役以磨耗為因，每件一次；回收須本人在櫃臺，庫存修復／熔鍊不需人。

schema 1 驗證器保留在 engine.js；tests/fixtures/engine-v1.cjs 是本專案 v0.4 原始引擎，用於真正舊存檔生成與遷移測試，不在頁面載入，也不是玩家存檔。維持舊 storage key，不重置進度；日期、交易額、歷史順序保留，新參數不捏造舊磨耗。

已通過 33 項引擎＋9 項實際 app.js 的 Node DOM 狀態／事件測試，總共 42。涵蓋開關店去重、中斷、在場範圍、無採購數量上限、溢位、磨耗、故事證據、傳承效果、跨人再售、金鈴日常與委託、舊存檔等。這些不測 CSS 幾何或真正瀏覽器點擊。

本輪遵從使用者指示，不啟動本機服務或瀏覽器。tests/browser.cjs 已更新新流程、只做語法檢查，不能稱 v0.5 UI 實測通過。使用者先前接受 v0.4 版面；v0.5 尺寸與狀態需 Pages 雲端復測。GAME_URL 指定 Pages 時不啟動本機遊戲服務。

Git／Pages 排除實際存檔、QA、秘密、個人主目錄。發布來源 main 根目錄 .nojekyll。D 槽原專案更新只同步遊戲與測試文件，保留 QA 和任何玩家資料，不重新開啟 localhost。不要套用 AGENTS 中啟動 server 的舊例行步驟覆蓋本輪明確停止要求。
