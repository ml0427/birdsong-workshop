# 專案筆記

v0.6、schema 3。純 HTML/CSS/JavaScript + Node，無依賴。SPEC.md 為規則，CLOUD_QA.md 是兩條代表分支的實際操作與結果。

content.js 為原創九節點資料，瀏覽器先載入 content→engine→app，server 允許清單亦已增加 content.js。事件只在當月真實 use 後建立；content.events 是一次旗標兼使用證據，保存 key、actor、item／episode、month、branch、磨耗／結果快照與 news ID。不能因出售或信任回填已有效事件。

需求由真實使用節點、合用在用品與磨損引出，不再每月無限備用。拒單紀錄以 npc/recipe 月份儲存，冷卻一月；未處理 request 跨月，service 可接採購與送客。無新需求的 social service 輪替或因贈還到訪，短 contextText 說明目前狀態。

recommendationReason 是唯一合用判斷來源；優先明說原退役者不買回同一物，再列用途／磨損／品質／特性。app 作品卡顯示短原因，顧客文案已 escape。其他在場 token、revision、任意合法正整數採購、開店結算、關店隱櫃、價表維持。

schema 1 先走保留的舊格式驗證與裝備映射，再進 schema 3；schema 2 先嚴格驗證，完整保留原參數／持有期／金額／待辦，新增空內容旗標與拒單紀錄，不虛構既往新內容。tests/fixtures/engine-v1.cjs 與 engine-v2.cjs 為本專案實際舊引擎，用於真存檔遷移測試，非玩家存檔、非瀏覽器資產。

58 項測試全部通過：33 原引擎、14 新內容與兩條全流程、11 實際 app.js 最小 DOM／localStorage 狀態與事件。原 42 項保留；只更新冷卻／非固定購物、schema 3 和新存檔欄位帶來的舊測試假設，不刪核心回歸。兩條從新遊戲到第 6 月測得精良護腕普通 wear 2、傳承 solid wear 1；重載、跨主、未使用／缺料／拒單均驗證。

使用者明確禁止本機服務／瀏覽器操作，本輪保持關閉；AGENTS 舊例行 server 指令不得覆蓋。browser.cjs 只語法檢查，本批實際 CSS／滑鼠／鍵盤與兩分支由 Pages 雲端復測，不能宣稱非瀏覽器測試等於實玩。

推送指定 repo main、Pages 根目錄 .nojekyll 已獲授權，保持可見性。不提交實際存檔、QA、秘密或個人主目錄。D 槽只同步版本來源／測試／文件，保留玩家資料。完成本批後停止擴張，交雲端確認。
