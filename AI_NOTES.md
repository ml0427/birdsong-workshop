# 專案筆記

v0.10，schema 5。SPEC.md 是單一現行規則。純 HTML/CSS/JS + Node，無依賴。正式資料夾 D:\AI_workspace\birdsong-workshop。2026-10-02 使用者明確要求「以後都自動推送」：完成修改並通過相關測試後，自動提交、同步 D 槽並推送 origin/main，不再逐次詢問、不強制推送。仍不啟動本機服務／瀏覽器；覆蓋 AGENTS.md 啟動舊例。

保留 v0.8 月份製作、NPC 單一背景任務、指定成品／當面交貨、材料知識順序、實際使用／贈還／熔鍊及原九內容節點。普通品質售價 14／20／26；金鈴一次加價規則不變。原 demand 公平性與未知內容遮蔽繼續驗證。

本批只有小禾一條個人勘路線銜接一條驛道世界線。journey.growth.he 記 level／pathfinding，由可靠首次近程探索或 scout、he-wrist／he-shield 證據推導；相同種類重複、對話、買賣或空過月不加。其他人物不加成長支線。

journey.events 順序 he-near→he-clue→he-survey→road-open，月份嚴格遞增。advanceJourney 在當月普通 NPC 使用後執行，引用實際 episode／效能／磨耗快照，不另多磨一次；本人當月剛收的物品不能作本月冒險證據。gear 必須 owned 且 owner he、當月使用、未贈還、護腕／木盾指定效能與特性且剩耐久至少 4。世界狀態由真實節點導出，不另有可獨立偽造的完成旗標。

缺口經 journeyHint 在本人對話／人物頁逐步顯示，不公布整套觸發公式。journeyDemand 僅已具原飛石經歷且到裝備階段時優先細緻護腕／盾需求，復用普通交易與製作委託。保留未處理需求 ID、既有交貨優先與冷卻；結算只同步已進裝備階段且同用途的普通需求品質／特性。人物頁在首個近程紀錄或原故事後顯示，不新增大型任務頁。

journey.outings 的 scout／gather 共用 request ID、seq、NPC pendingTasks。scout 6 枚次月木頭 1；真實原探索也能銜接所以不重複勘路獎。世界完成後 gather 6 枚次月已知材料 3；新 exploration.quantity 從 2 變 3，接受時鎖定，既排隊 2 不追補。reservedMaterial 一併計訂單、探索、勘路採集預留，避免溢位或提前補助。

真實 schema 1–4 遷移：1–3 保留舊成品及五材料知識；4 完整保留目前已知材料、在製品工期與各委託，探索補原 quantity 2。只從可靠內容及帶本人交付鳥信的探索推導能力，journey.events 永遠初始空，讀檔不發新劇情。無可靠近程紀錄仍可 scout，舊材料全知不堵死。fixtures 是專案舊引擎，v4 從 v0.8 提交複製且只調整 content require，無玩家資料。

125 項全通過：原 117 保留，新增 8 最終審查（含 2 實際 UI 事件測試）。正常引擎流程於月 4／5／8／9 依序完成新四節點，可用 materialLimit 暫停新材料探索驗多一份效果；不是固定觸發月份。campaign state 選項用於缺裝備後正常補足續玩，capture 保存已驗證快照，不編旗標。部分負面裝備磨損／明確需求仍用 fixture，不能把全套說成沒有 fixture。

ui-harness 執行真正 app.js，但非瀏覽器幾何驗證。build 與 browser.cjs 語法檢查通過，瀏覽器腳本本輪未執行。npm 全域入口缺失，直接 Node 命令正常，不修全域環境。保留 qa、玩家備份與非原始碼資料，D 槽只同步 git 追蹤檔、hash 驗證。

v0.7 公開推送曾被自動審核拒絕；其後指示停止發布，v0.8／v0.10 沒有嘗試推送。Pages 仍 v0.6／09876dcf004d9374ee04db3abfb889d15812c0a3。不得把本機新版稱已上線。

最終審查：兩項直接回歸在修正前確實失敗（盾耐久 4 誤報備好、舊檔普通護腕仍要求樸實），修正後與原 117 全通過。audit-helpers 的 actor 將每次公開操作輸入遞迴凍結，完整重播所有成功 dispatch 並比對最終狀態；沒有直接修改狀態、物品、能力或旗標。新檔延期取貨路線第 4／5／9／13 月完成節點，熔鍊與跨主再售都實際走通。詳細每月裝備及操作見 AUDIT.md；腳本只印 JSON，不啟動服務或瀏覽器。停止新增內容。
