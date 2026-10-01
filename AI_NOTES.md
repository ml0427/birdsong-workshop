# 專案筆記

遊戲版本 v0.3，存檔 schema 1。純 HTML/CSS/JavaScript + Node 靜態伺服器，無套件依賴，規則見 SPEC.md。

狀態透過 engine.js dispatch 驗證後原子修改。月份僅開店前進；訂單以 request ID 去重；物品採唯一 registry 保存持有權與歷史；熔鍊傳承只使用一次。

已完成 17 項引擎測試及 9 組 Chromium 介面驗證。首次新顧客固定要求銅澆水壺，以支援教學中斷。主存檔損壞時可復原上一筆備份。

Git 交付排除所有 qa 產物、實際存檔、秘密與個人主目錄路徑。Windows 原專案與玩家進度沒有改動。瀏覽器測試使用獨立資料夾與本機 4328；雲端請指定 CHROME_PATH。
