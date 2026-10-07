# A 區 Web OSC 控制

公開網頁：https://vistwinproject.github.io/A-Web/A_ZONE_OSC.html

數據之門 A 區控制面板：Scene1–5、NO_VIEW／顯示、實際 TD 與左右牆同步回報、OSC 連線設定。

現場電腦須啟動 A/B TouchDesigner 與 A 區 START-WEB.cmd。首次使用公開網頁時，在 OSC 設定填入橋接服務網址，例如 http://192.168.0.2:8788；手机與電腦需在可互通的網路上。若瀏覽器要求區域網路存取請允許。不能直接連線的手機瀏覽器，可在 OSC 設定點「開啟現場控制頁」。

GitHub Pages 只提供網頁。控制命令由現場橋接服務送出 UDP OSC，頁面選取狀態來自 TD 回報；斷線時控制按鈕停用。GitHub 不接收現場主機設定或控制命令。

Scene1=0、Scene2=1、Scene3=2、Scene4=3、Scene5=4；NO_VIEW=0、顯示=1。Web 未換幕前保持目前幕次與循環播放。

本 repo 只保存公開網站資產。完整 TD、影片與橋接程式仍在原 AC-TouchDesigner 私人 repo。