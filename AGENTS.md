# 專案工作規則
- 只修改本專案。讀取 SPEC.md、AI_NOTES.md，完成後更新 AI_NOTES.md。
- 純 HTML/CSS/JavaScript + Node 本機靜態伺服器，無 Tauri，不套用全域的 Tauri 啟動步驟。
- 執行 `node --test tests/engine.test.cjs`、`node scripts/build.cjs` 後啟動 `node server.cjs`。也提供對應 npm scripts。
- v0.1 為初版；後續修正手動增加小數點後版序，建置時間由 scripts/stamp-build.cjs 產生。
- 未經使用者明確授權，不公開部署或推送。不要安裝全域套件，不改其他專案。
