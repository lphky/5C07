# 專案指引

先讀 README.md、TEST-RESULTS.md。純前端學生魔咒遊戲，GitHub lphky/5C07。保留最新完整版本的 1v1、2v2、12 魔咒及搶四勝。沒有學院天賦或語音功能。圖片來源只有文字描述，目前用 emoji，勿聲稱已還原原圖。依使用者 2026-11-02 指示公開於 https://lphky.github.io/5C07/ ，GitHub 專案亦為公開；保留 main 根目錄 Pages 發布方式及現有公開可見性。

結算由 computeTurn() 產生事件列表（每步附 HP 快照），介面 playEvents() 逐步播放；改規則時須同時產生對應事件。修改結算後執行 node --check game.js 與 node test.cjs。測試以 Node VM 執行真實對戰函式，DOM 及音效使用替代物；瀏覽器測試須額外進行。
