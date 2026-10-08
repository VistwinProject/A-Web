# A 區 Web OSC 控制

公開網頁：https://vistwinproject.github.io/A-Web/A_ZONE_OSC.html

數據之門 A 區控制面板：Scene1–5、NO_VIEW／顯示、實際 TD 與左右牆同步回報、OSC 連線設定。

iPhone 使用時，保持 Tailscale VPN 開啟，在 OSC 設定貼上橋接管理者提供的 8 位手機配對碼。公開頁面預設連到私人 HTTPS 手機通道；配對碼保存在手機，沒有寫入此 repo。

HTTPS 通道只允許既有狀態查詢、Scene1–5 與 A 區開／關指令；OSC 目的地由本地橋接配置。使用者仍需在電腦啟動 A/B TouchDesigner、OSC 橋接與手機通道。手機不需貼程式碼。其他現場 HTTP 或 HTTPS 橋接仍可在 OSC 設定手動填入。

GitHub Pages 只提供網頁。控制命令由現場橋接服務送出 UDP OSC，頁面選取狀態來自 TD 回報；斷線時控制按鈕停用。GitHub 不接收現場主機設定或控制命令。

Scene1=0、Scene2=1、Scene3=2、Scene4=3、Scene5=4；NO_VIEW=0、顯示=1。Web 未換幕前保持目前幕次與循環播放。

本 repo 只保存公開網站資產。完整 TD、影片與橋接程式仍在原 AC-TouchDesigner 私人 repo。
