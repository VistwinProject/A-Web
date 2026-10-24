# A-Web — 現場控制網頁與啟動入口

現場來源回存／文件更新：**2026-10-24（Asia/Taipei）**。中央啟動腳本最後修改 **2026-10-22 14:27**；控制頁 **2026-10-14 21:37:10**；Node 服務 **2026-10-12 01:53:28**；左右啟動檔 **2026-10-13 21:59**。

本版以 A 中央與左右主機的現場原檔為準，只保存控制網頁、橋接與啟動程式。TD 專案、媒體、mapping 及執行日誌不納入 Git。推送來源不會重新部署現場。

## 正式啟動

需要現場既有 TouchDesigner 2025.33230、Node.js（`C:\Program Files\nodejs\node.exe`）與專案內的 TD API／節點。Node 服務只使用內建模組，沒有 npm 安裝或打包步驟。

中央主機桌面部署關係：

```text
Desktop/
  A_Final_cmd.cmd              ← launchers/central/
  A_Final_start.ps1            ← launchers/central/
  Final_A_Web/                 ← 本 repo 根目錄的網頁、mjs、json 與啟動檔
  Final_A_TD/Final_A_TD.toe     ← 現場保留，不在 Git
  Final_A_TD/media/            ← 現場保留，不在 Git
```

雙擊桌面 `A_Final_cmd.cmd` 啟動完整流程。它使用同目錄 PowerShell，檢查 TD 與音訊、開啟 Node 服務、設定左右主機、最後重置為黑畫面並開啟網頁。**此入口會改變播放狀態，不要為了檢查而在演出中重跑。** 不要直接在 repo 的 `launchers/central` 內執行；先依上述位置部署。

`START-WEB.cmd` 或 `OPEN-LOCAL-WEB.ps1` 僅啟動／開啟網頁服務，不能替代完整 TD 初始化。每台中央機只啟動一個橋接服務。

左右主機桌面放置 `launchers/sides/A_LR_Final_cmd.cmd` 與既有 `A_LR_Final_TD.toe`。此入口辨識 WS050R 維護螢幕，若已開啟符合名稱的 TD 編輯器，就整理既有視窗；它不保證重新載入最新檔案。

## 網頁與 X 主控

- 中央本機：`http://127.0.0.1:8788/A_ZONE_OSC.html?phonefix=5`。
- 10/24 現場中央區網介面：`192.168.168.142`；iPad 使用 `http://192.168.168.142:8788/A_ZONE_OSC.html`，以現場實際網段為準。iPad 的 localhost 不是中央機。
- 中央 → TD：UDP `127.0.0.1:9200`，狀態回報 `9202`。
- 中央啟動腳本目前設定左右機為 `192.168.168.143`，使用 9201／9100。程式中的 B 指 A 展區左右牆，不是 B 展區 Web。
- X 透過 `GET /api/status` 讀取狀態，`POST /api/action` 傳送 `play`、`animation`、`reset`。`sent:true` 只代表已發送，仍須核對新鮮的 TD 狀態與左右同步確認。

| 控制 | 現場行為 |
|---|---|
| 播放 | S1 → S2 → S3 停留，等待啟動動畫 |
| 啟動動畫 | S4 → S5 → reset 黑畫面 |
| 重置 | NO_VIEW；停止自動流程 |
| 01～05／自動／手動 | 保留個別幕次操作 |

現場 `playback.json`（**2026-10-15 02:27:08**）：20.97、8、第三幕等待、13、38.6 秒。S5 結束後為黑畫面，並非舊 README 的回到 S1。

`config.json` 保存 TD 目標與 OSC 通道；`playback.json` 保存實際秒數，部署時不要用預設值蓋掉更新過的現場設定。

## GitHub Pages 與舊 Python 入口

[公開控制頁](https://vistwinproject.github.io/A-Web/A_ZONE_OSC.html) 的 `index.html` 與 `A_ZONE_OSC.html` 同步更新。Pages 只能提供靜態頁面，現場仍需 Node 服務；建議 iPad 直接使用區網網頁。公開頁面的舊預設橋接 IP 是 `192.168.200.143`，換網段時須在 OSC 設定指定目前中央機；本次原樣保留程式，未以推測值修改現場邏輯。

`A_OSC_RELAY.py`、`START-RELAY.cmd` 與 [歷史 Python 說明](RELAY-使用說明.txt) 保留作舊版參考。**正式三鍵流程使用 Node `server.mjs`；不要用舊 Python 入口替代，或與 Node 同時占用 8788／9202。**

## 驗證與限制

`npm test` 執行本次新增的離線流程／OSC 測試；不連接現場、不發送切幕。另已檢查 Node 模組與 PowerShell 語法。

10/24 即時狀態快照：中央連線、左右幕次／開關確認皆為 true，當時為 NO_VIEW/reset。完整演出、冷啟動與長時間穩定性未在本次重測。左右機視窗顯示 `.1`、磁碟有 `.4` 與固定入口；未比對 TD 內容，不能據此斷言版本錯誤。

詳見 [現場來源清單與修改時間](docs/ONSITE-2026-10-24.json)。
