# 專案筆記

v0.7，schema 4。優先讀 SPEC.md 首段最新使用者規則，其下為歷史預設。純 HTML/CSS/JS + Node，無依賴。專案正式位置 D:\AI_workspace\birdsong-workshop，既有 repo／Pages 已獲明確推送授權。使用者禁止本輪啟動本機服務或瀏覽器，覆蓋 AGENTS.md 的啟動舊例。

初始材料木鐵各 3，只認識兩種；無工時／容量。item.status crafting，dueMonth／finishedMonth 控工期，只 settle 在 open 時完成；craft XP 完工才增加，品質／傳承開工鎖定。所有拒絕保留原狀，revision／counter token 保留。櫃臺始終放開關店，closed 隱藏人物但可重開。

knownMaterials 為有序前綴；explorations 按未知線索逐步帶回銅／銀／金，報酬 6、交付 2，不能跨 NPC 並行探索同一前沿。一般 UI 遮未知配方與材料名稱。訂購任意可安全計算的正整數，與探索、客人製作共用 request ID 去重。

pendingTasks 為共用單一任務檢查，UI 有方向文字。commissions 記 accepted→crafting→ready→delivered，accepted 可當面 cancelled；c.itemId 與 item.reservedFor 雙向驗證。成品不一般出售，delivery visit 當面交貨才收入與持有。拒領後每月新的 delivery ID 可再來，不先捏造使用；每月只生成一份等待中的該 NPC 來訪。

製作變慢後 worn replacement 會餓死新內容需求，demand 將已具前置而未觸發的用途優先。content.js 九節點資料與 event evidence 保持；未來個人／世界任務需看 NPC 能力、實際裝備與歷史，不只材料。暫無新增等級數值或劇情。

真實 schema 1／2／3 遷移；舊三版已認識五種材料，不抹去。舊成品 dueMonth null、finishedMonth 原 createdMonth，不追扣／重製。legacyTaskIds 僅保存舊多張 pending，全部完成才解除忙碌。fixtures 是專案舊引擎，engine-v3 只改 content require 相對路徑；不含玩家資料。

47 項測試通過（31 核心、5 完整內容流程、11 UI VM）。使用實際動作跑九節點與普通／傳承兩分支；部分核心極端驗證使用聚焦需求／算術狀態 fixture，不能稱全測試沒有 fixture。browser.cjs 已改月份制，只語法檢查；雲端 QA 才是真正畫面實玩。npm 全域入口缺失，用 Node 命令，不修全域環境。

保留 qa、玩家備份、所有非原始碼資料。D 槽只同步本專案追蹤原始碼／測試／文件，確認路徑與 hash。發布後確認 Pages built 的 SHA 及 HTTP 資產與本次 commit 一致；不得把 HTTP 一致聲稱 UI 實測。

本次 v0.7 推送被自動審核拒絕，仍認最初不公開部署限制有效。命令未執行，沒有其他發布途徑；Pages 仍是 v0.6。D 槽 28 檔案已同步 hash 比對，D 槽再次 47 tests 通過。需父對話補可供審核驗證的明確公開推送授權，才可完成發布、部署 SHA／HTTP 比對與雲端 UI 測試。
