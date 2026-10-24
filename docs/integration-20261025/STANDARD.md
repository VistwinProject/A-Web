# 全區整合共同標準 v1

建立／修改：2026-10-25（Asia/Taipei）。狀態：規格與工作分支建立；不代表功能已實作。

兩個目標分開交付：① E 自由選章新版與 X 正式相容；② A–G iPad 與 X 使用統一的各區音量控制。所有 repo 採用本標準與驗收編號，不能只更新 E 就聲稱全場完成。

## 分支與來源

- `codex/e-x-compat-v1-20261025`：只在 vb-anlb-e 與 X-Controller 建立。
- `codex/zone-audio-v1-20261025`：A-Web、Final_B、Final_C、Final_D、vb-anlb-e、F-table、F-wall、F-Ipad、Final_G、X-Controller。
- repo 已代表區域，相同功能使用相同分支名稱。v1 是本次共同契約版本；日期是工作批次，不是部署日期。後續提交不每日改名。
- E 相容分支從已保存的設計分支 3ca3732 延伸，包含候選預覽歷史；X 相容分支從核對過的 main 延伸。E/X 音量分支堆疊於各自相容分支；其他音量分支從核對過的 main 延伸。
- E 設計分支的原有混合文件保留作歷史來源；後續實作以本功能分支為工作入口，不再用單一 E repo 宣稱完成全區整合。
- 實作與部署均以當日現場為基準；main 快照不是保證現場當日最新。若現場有差異，先納入對應分支，再做功能修改。
- 不上傳 TD 工程、私密設定、憑證、Chrome profile、執行紀錄或校準值。TD 需要配合時記錄受控工程版本與參數契約，維持使用者既定範圍。

## 完成標準

每個功能分開記錄 planned → implemented → offline_verified → field_verified。只能依證據前進，不以文件齊全、HTTP 200 或 GitHub merge 代替功能及現場驗收。

各 repo 必須提供來源 commit、現場差異、音源／接口對照、修改檔案、共同測試與區域回歸、X 相容版本、部署／回退步驟及修改日期。未知填 null／未核實，不填推測值。僅有合約的 G 不得標記 implemented。

## E／X 相容門檻

- E1：X 新 adapter 接舊 E，舊操作與保護不變；control 欄位不存在可沿用原狀。新欄位失效／版本不支援時只停用 E 操作，其他區不受影響。
- E2：guided 保留開始、00–02 章末等待、03 自動接 04、原完成停留／淡出／回待機。
- E3：free 允許 PAD 跳章、暫停／續播、獨立結尾；控制權與章末競態序列化，既有唯一音訊與四路輸出不重建成預覽單頁。
- E4：PAD 接手期間 X 顯示實際可操作項；不能假造故障來停用按鈕。播放控制權與音量權限分開。
- E5： queued 不等於執行完成，舊 epoch／重複請求不得復活音訊；現場 watchdog、聲光、Mapping、四路輸出與回退另驗。

## 音量契約 audio.v1

### 對象與身份

每區後端是唯一音量狀態權威；本區 iPad 與 X 操作同一份值。zoneId A–G，sourceId 對應真正發聲端而非螢幕。身分與區域權限由可信後端驗證，不能相信 payload source、WebSocket role 或 IP。X 聚合與轉送，不另保留可覆蓋現場的主音量。

### 能力與狀態

新增獨立 capability `audio.v1`；沒有能力、音源未核實或離線時，音量控制不可操作。不得為了測試猜測端點並發送音量指令。

狀態必要欄位：schemaVersion=1、zoneId、epoch、revision、capabilities、desired(level, muted)、observed(level, muted) 或 null、status、requestId 或 null、sources、observedAt。level 為整數 0–100，代表區域校準範圍的相對值，不是分貝；每個 source 回報自身 appliedRevision、連線與實際 gain／mute。無發聲能力的區域回 unsupported，不虛構已靜音。

status：unsupported／offline／idle／pending／applied／partial／failed／unknown。綠色 applied 必須全部必要音源讀回相符；UI 拖曳目標值與已套用值分開。網頁回報仍不能證明實體喇叭正在出聲。

### 寫入與競態

建議 GET `/api/audio/state`、POST `/api/audio/command`；各區既有 transport 由 adapter 轉換，但語意必須一致。命令包含 requestId、zoneId、expectedEpoch、expectedRevision，以及 setLevel 的 level 或 setMuted 的 muted。加減按鈕計算絕對目標值，不送可重複累加的 delta。

後端按 epoch/revision 原子接受，版本衝突回 409；未知／不支援能力不可送出。重複 ID 同內容回原結果，不同內容拒絕。網路失敗／unknown 不自動重送；先讀狀態再由使用者決定。兩端同時調整只接受先匹配 revision 的操作，另一端刷新並提示，不偷偷覆寫。

UI 每區最多一筆在途命令，拖曳中間值合併、最多每 200 ms 一次、放手送最終值；遇到他端衝突停止本次拖曳。正常網路目標約 1 秒內回饋，3 秒未確認顯示未確認，屬待測性能目標。

### 播放與保存

區域 master gain 與原場景淡出相乘，保留原音訊仲裁。mute 與 level 分開；靜音不暫停播放，靜音中調 level 不解除靜音。換章、回待機、播放器／主機重啟不得恢復 100%。只保存已確認設定，啟音前套用；設定損壞或裝置改變保持靜音並提示，不擅自開大聲。

不預設使用作業系統主音量，不解除原本靜音的顯示頁。多音源部分成功回 partial，逐源回報，不以單個成功假裝整區完成。G 先取得業主接口；A/C TD 先核實發聲端與參數，不能假設改網頁即有效。

## 音量共同驗收

| ID | 必須通過 |
|---|---|
| A1 | 本區 PAD 與 X 雙向調音／顯示同步，其他區不變 |
| A2 | 換章、換音檔、重播、待機與淡出不覆蓋 master gain |
| A3 | 靜音不暫停，解除恢復設定，不出現瞬間最大聲 |
| A4 | 兩端競態、重複 ID、舊 epoch、逾時不抖動或重送 |
| A5 | X／播放器／區域後端重啟後保存與重連正確 |
| A6 | 音源部分離線或未支援不顯示假成功 |
| A7 | 權限不能跨區；播放接手不限制合法音量調整 |
| A8 | 現場逐區確認聲音出口、校準上限、無爆音與重複聲音 |
| A9 | 保留區域原有 NFC／TD／畫面／章節／燈光回歸 |
| A10 | 回退後恢復原控制與聲光；不改無關區域 |

A1–A7 的離線通過與 A8–A10 的實體驗收分開記錄。各 repo 不得自行更換音量尺度、錯誤語意或完成判斷；契約需變更時更新共同版本及全體副本雜湊。

## 合併與部署順序

1. X `e-x-compat` 先 merge：對舊 E 相容，新增能力判斷不啟用新功能。
2. E `e-x-compat` 再 merge：E1–E5 離線驗證及組合版本確認後合入；不是允許現場部署。
3. X `zone-audio` 在 X 相容分支合入後 merge：未提供 audio.v1 的區域維持禁用，不猜測支援。
4. 各區 `zone-audio` 在 X 音量相容支援合入後逐區 merge；E 音量另外依賴 E 相容已合入。建議先 E 驗證完整鏈路，再 F，A/B/C/D 依音源核實與實作完成順序。這是交付順序，不是假稱某區已可實作。
5. F-table／F-wall／F-Ipad 作同一發布批次，三份共同來源 SHA 核對；不要把一區拆成三套互相競爭的伺服器。不完整批次不部署。
6. G 最後，且必須先由業主工程師確認現役 repo／接口；Final_G 只是協作起點，不能以此分支覆蓋業主現場。

可先以功能分支的固定 commit 做跨 repo 離線整合，不必為測試而提前 merge。若上游分支以 squash 合併，下游先整合最新 main 並檢查只剩自己的功能差異，不能把舊提交重複合入。

部署另排使用者能到場時段：X 先部署相容版本並驗證舊各區，再逐區部署／驗收／啟用；當區失敗當區回退，X 保留舊契約相容。不合併、不部署此輪文件分支作為正式功能交付。需確認任何 repo 自動部署規則後才允許合併正式功能。
