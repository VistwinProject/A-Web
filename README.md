# A 區 OSC Web

https://vistwinproject.github.io/A-Web/A_ZONE_OSC.html

在 TD 電腦啟動 A_OSC_RELAY.py，或將整份程式碼貼進 Text DAT 並 Run Script。
手機在 OSC 設定只填電腦 IP，例如 192.168.200.143。不使用 VPN 或配對碼。
預設 TCP 8788 → UDP 127.0.0.1:9200，回傳 9202。需收到真正 TD 回報才啟用控制。

Scene1–5 對應 /ac/scene 0–4；NO_VIEW=/ac/view 0；顯示=/ac/view 1。
手機與電腦需在可互通網路。Safari 若阻擋 HTTPS 頁面連區網 HTTP，需使用手機信任的 HTTPS 轉送服务；單靠轉送程式無法解除瀏覽器限制。程式支援 --cert 與 --key。

轉送服務沒有 Python 執行 API，不修改 TD 效果或媒體。詳見 RELAY-使用說明.txt。