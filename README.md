# 生命線 Lifeline Suite

一套整合個人任務、生命價值、課程安排、自主訓練、國中數學題庫與 LINE 預約入口的瀏覽器工具系統。

## 線上入口

- 生命線：`https://xieyaozhong.github.io/Lifeline/`
- 專案中心：`https://xieyaozhong.github.io/Lifeline/portal/`
- 時序環：`https://xieyaozhong.github.io/Lifeline/schedule-studio/`
- 自主訓練自核單與國中數學題庫：`https://xieyaozhong.github.io/Lifeline/self-training-checklist/`
- 約定產生器：`https://xieyaozhong.github.io/Lifeline/appointment-generator/`

所有頁面右下角都有共用的 Lifeline 工具切換面板。

## 應用程式

### 生命線

- 健康、智力、財富、地位、技能五維生命值
- 任務限時、超時處理與即時推薦
- 每日自動排程、生命速度與維護債
- JSON 匯出／匯入與 PWA 離線快取

### 時序環

- 拖曳課程卡，自動尋找可用時段
- 24 小時圓形課表與傳統課表
- 連續三日總覽與目前課程指示
- 3～12 歲兒童 09:00–17:00 全天課程
- 依年齡、場域與活動類型自動安排休息、午餐與教室

### 自主訓練自核單

- 依每日題量與可用時間建立嚴格訓練時間線
- 強制拆分解題、檢討、休息與彈性緩衝
- 單輪延誤加重上限 20%，無法吸收的題量轉為下次待補
- 學生自核作答題數、正確率、耗時、檢討時間、體感難度與卡關原因
- 14 日趨勢、主題診斷、教師摘要與下次練習量建議
- 內建七、八、九年級共 15 個核心數學主題
- 基礎、標準、進階三段難度與可重複生成的原創題型
- 練習模式、限時測驗、錯題解析、弱點再練與最近練習紀錄
- 題庫結果依主題自動寫入自核紀錄與回課分析
- 可將題庫主題與題數一鍵套用到今日嚴格計畫
- JSON 匯出與可列印的每日自核單

### 約定產生器

- LINE 官方帳號預約訊息模板
- 直接預約與加入好友兩種 QR Code
- LINE 深連結、PNG 下載與常用設定保存

## 資料儲存

目前任務、課表、題庫作答、自核紀錄與常用約定預設保存在瀏覽器 `localStorage`。清除網站資料前，請先匯出需要保留的資料。

## 本機執行

### Windows

雙擊 `run_windows.bat`，瀏覽器會開啟 `http://127.0.0.1:8765`。

### 其他系統

```bash
python3 server.py
```

## 本機建置與驗證

```bash
python3 scripts/validate_site.py
python3 scripts/build_site.py
```

建置結果會輸出到 `_site/`，並自動：

- 複製所有應用程式與共用資源
- 注入全站工具切換面板
- 產生 `build-info.json`
- 保留 GitHub Pages 的 `404.html`、`robots.txt` 與 `sitemap.xml`

## GitHub Pages 部署

推送到 `main` 後，`.github/workflows/pages.yml` 會執行：

1. 組合並檢查 Lifeline 與國中數學題庫的分段 JavaScript。
2. 檢查所有 JavaScript 語法。
3. 檢查 HTML 重複 ID 與本機檔案連結。
4. 建置完整 `_site`。
5. 驗證五個應用程式入口、題庫資源與部署資訊。
6. 上傳並發布 GitHub Pages。

Pull Request 另有 `.github/workflows/validate.yml`，只執行驗證與建置，不會發布網站。

第一次部署需在儲存庫 **Settings → Pages → Build and deployment** 將來源設為 **GitHub Actions**。
