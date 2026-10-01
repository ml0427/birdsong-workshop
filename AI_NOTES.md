# 專案筆記

v0.8，schema 4。SPEC.md 是單一現行規則。純 HTML/CSS/JS + Node，無依賴。正式資料夾 D:\AI_workspace\birdsong-workshop。最新指示只本機提交與同步，不推送，不啟動本機服務／瀏覽器；覆蓋 AGENTS.md 的啟動舊例。

初始木鐵各 3，只認識兩種；無工時／容量。item.status crafting，dueMonth／finishedMonth 控工期，只 open 結算完成；製作 XP 完工才增加，品質／傳承開工鎖定。拒絕保留原狀，revision／counter token 驗證。關店櫃臺保留門控，不顯人物。

knownMaterials 為有序前綴；explorations 逐步帶回銅／銀／金，報酬 6、交付 2，不能跨 NPC 並行同一前沿。一般 UI 及保存規則遮未知配方與材料；月份文字用基本／複雜作品。訂購任意安全正整數，與探索、客人製作共用 request ID。

pendingTasks 共用單一任務；commissions accepted→crafting→ready→delivered，accepted 本人在場可 cancelled。c.itemId 與 item.reservedFor 雙向驗證。保留成品不普通出售，當面交貨才收入／持有，下一月才能使用；拒領下月新 delivery ID 再訪。NPC 不在場仍可為已接受委託開工。

需求先依未完成且具前置證據的新用途排序，再依該人物該配方真實持有期 since 的最後月份，較久未供應優先。v0.8 修復完成九節點後早期替換壓過普通金鈴的飢餓問題。content.js 九節點與 evidence 保持，沒有新增劇情。

真實 schema 1／2／3 遷移，舊五種材料知識保留。舊成品 dueMonth null／finishedMonth createdMonth，不追扣／重製。legacyTaskIds 保存舊多張 pending。fixtures 為專案舊引擎，v3 只調整 content require 相對路徑，不含玩家資料。

88 項全通過：31 核心、5 完整內容、10 複雜遷移、15 回歸、27 UI。campaign.cjs 抽共用正常操作長流程，trace 測一次加價與普通循環。ui-harness.cjs 執行真正 app.js，最小 DOM／localStorage／Blob／確認框；不是瀏覽器幾何驗證。極端算術／特性部分 fixture，不能稱全測試無 fixture。測試入口 node --test tests/*.test.cjs。

build 與 browser.cjs 語法驗證通過，瀏覽器腳本未執行。npm 全域入口缺失，用 Node 命令，不修全域環境。保留 qa、玩家備份與非原始碼資料，D 槽只同步 git 追蹤檔，hash 驗證。

v0.7 推送曾三次被自動審核拒絕，命令未執行；父對話已指示停止發布，v0.8 未嘗試推送。Pages 仍 v0.6／09876dcf004d9374ee04db3abfb889d15812c0a3。未來另獲可核對授權才處理發布；不得把本機新版稱已上線。
