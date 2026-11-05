# 專案指引

先讀 README.md、TEST-RESULTS.md。純前端學生遊戲，GitHub lphky/5C07，公開 https://lphky.github.io/5C07/ ，保留 main 根目錄 Pages 及公開可見性。

2026-11-05 最新使用者附件已取代舊版規則：單人、八魔咒、索命咒半血、護盾反彈、率先四勝，含瀏覽器語音。不再使用舊版 2v2／12 魔咒引擎。index.html 為版面，game.js 為對戰邏輯。玩家須按繼續才觸發 AI，局間及最終結果保留供閱讀。勿重新加入自動快速覆蓋結果。

改結算後執行 node --check game.js、node test.cjs；瀏覽器測試另做。外觀仍依賴 CDN，真實手機語音須另行驗證。
