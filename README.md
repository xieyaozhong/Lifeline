# 生命線 Lifeline

把每日任務、能力成長與生命價值連結起來的個人管理 PWA。

## 線上版本

GitHub Pages 部署完成後，可從以下網址開啟：

`https://xieyaozhong.github.io/Lifeline/`

## 目前功能

- 健康、智力、財富、地位、技能五維生命值
- 生命總值、今日增加值與生命價值／小時
- 固定時間、每日、每週及完成後間隔重複任務
- 每日自動排程與負荷控制
- 任務完成比例、品質、難度、連續與槓桿係數
- 維護債、歷史紀錄與生命線趨勢
- JSON 匯出／匯入備份
- 手機與桌面自適應介面
- PWA 安裝及離線快取

## 資料儲存

目前資料保存在瀏覽器的 `localStorage`。清除網站資料前，請先從設定頁匯出 JSON 備份。

## 本機執行

### Windows

雙擊 `run_windows.bat`，瀏覽器會開啟 `http://127.0.0.1:8765`。

### 其他系統

```bash
python3 server.py
```

## 部署

推送到 `main` 分支後，`.github/workflows/pages.yml` 會自動建置並部署 GitHub Pages。
