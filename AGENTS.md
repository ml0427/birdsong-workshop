# 專案工作規則
- 只修改本專案。讀取 SPEC.md、AI_NOTES.md，完成後更新 AI_NOTES.md。
- 純 HTML/CSS/JavaScript + Node 本機靜態伺服器，無 Tauri，不套用全域的 Tauri 啟動步驟。
- 執行 `node --test tests/engine.test.cjs`、`node scripts/build.cjs` 後啟動 `node server.cjs`。也提供對應 npm scripts。
- v0.1 為初版；後續修正手動增加小數點後版序，建置時間由 scripts/stamp-build.cjs 產生。
- 使用者於 2026-10-02 明確要求「以後都自動推送」。本專案完成修改並通過相關測試後，自動提交並推送 origin/main，不再逐次詢問；禁止強制推送。推送失敗或被自動審核阻擋時，如實回報。
- 不啟動本機服務或使用者瀏覽器，除非另有要求；此規則覆蓋上方舊啟動步驟。不要安裝全域套件，不改其他專案。
