# 變更日誌 (Changelog)

本專案遵循 [Semantic Versioning (語意化版本)](https://semver.org/lang/zh-TW/) 與 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 規範記錄專案的所有重要變更。

---

## [Unreleased]

### 修復 (Fixed)
- **MAVLink CRC_EXTRA 補齊與驗證校正**：
  - 補齊 `COMMAND_LONG` (#76, CRC: 152)、`COMMAND_ACK` (#77, CRC: 143) 與 `REQUEST_DATA_STREAM` (#66, CRC: 148) 的 CRC_EXTRA 數值。
  - 解決先前發送 MAVLink 指令封包時因缺少正確 CRC_EXTRA 導致飛控端校驗失敗並默默丟棄的問題。
- **目標 System ID / Component ID 自動識別與綁定**：
  - 串流解析加入自動偵測機制，即時提取接收封包中的真實 `sysId` 與 `compId`。
  - 「串流頻率設定面板」自動套用偵測到的飛控 ID，解決預設 `SYS: 1 / COMP: 1` 導致自訂 ID 或外接 GPS 模組無法接收指令的問題。

### 新增 (Added)
- **GCS 地面站心跳廣播 (Heartbeat 1Hz)**：
  - 串口建立連線後，自動以 1 Hz 週期廣播標準 GCS 心跳封包（`HEARTBEAT` #0，`MAV_TYPE_GCS`，SYS: 255 / COMP: 190）。
  - 主動維持與飛控通訊活躍鏈路，防止飛控因無地面站心跳而停止遙測串流或拒絕執行指令。
- **COMMAND_ACK (#77) 應答解析與狀態反饋**：
  - 支援完整解碼 `COMMAND_ACK` 封包，定義 `MavResult` 列舉型別（包含 ACCEPTED、TEMPORARILY_REJECTED、DENIED、UNSUPPORTED、FAILED 等詳細中文狀態）。
  - 指令發送（`SET_MESSAGE_INTERVAL` 與 `REQUEST_MESSAGE`）具備 1.2 秒超時等候機制，若收到飛控 ACK 立即於日誌顯示執行結果。
- **傳統資料串流請求編碼**：
  - 新增 `REQUEST_DATA_STREAM` (#66) 編碼函數，提供向舊版或特規飛控請求成組串流能力。
- **專案授權協議與線上入口更新**：
  - 補上根目錄 [MIT License](LICENSE) 授權文件。
  - 於 `README.md` 標註線上即用體驗入口（[https://labujuice.github.io/Web-Mavlink-GPS-Viewer/](https://labujuice.github.io/Web-Mavlink-GPS-Viewer/)）與 Live Demo 徽章。

---

## [0.1.0] - 2026-09-15

### 新增 (Added)
- **核心架構與主題**：
  - 100% 純前端無後端架構（Zero-Backend SPA），關閉或重整分頁立即重置。
  - 極簡 Cyber-Tactical HUD 視覺風格：純黑背景（`#000000`）、航電雷達綠（`#00ff66`）、線框方塊與等寬數據排版。
- **MAVLink 串流解碼器**：
  - 純 TypeScript 實現 MAVLink v1 / v2 二進制解碼狀態機。
  - CRC-16 (X.25) 封包驗證與 CRC_EXTRA 常數表。
  - 完整支援所有 GPS 相關訊息：`GPS_RAW_INT` (#24)、`GPS_STATUS` (#25)、`GLOBAL_POSITION_INT` (#33)、`GPS2_RAW` (#124)、`GPS_RTK` (#127)、`GPS2_RTK` (#128)、`GPS_INPUT` (#232)、`HIL_GPS` (#113)、`STATUSTEXT` (#253)。
- **資料輸入通道**：
  - **Web Serial API 原生串口連線與 COM 選擇介面**：
    - 新增直觀的 COM Port 選擇下拉選單與「+ 選取 COM 埠」按鈕。
    - 支援原生呼叫系統裝置選單（`/dev/ttyUSB*`、`/dev/ttyACM*`、Windows `COM1~COM32`）。
    - 內建常見晶片與飛控自動識別（Pixhawk STM32 VCP、Cube、CP210x、FTDI、CH340、u-blox GNSS 等）。
    - 具備專屬「COM 埠設定管理視窗 (`SerialPortModal`)」，支援設備重新整理、已配對列表與鮑率選擇。
    - 整合 `@vitejs/plugin-basic-ssl`，`dev` 與 `preview` 自動以 `https://` 啟動，符合 Chrome 安全上下文（Secure Context）要求。
  - **MAVLink 串流頻率請求與指令下發 (SET_MESSAGE_INTERVAL)**：
    - 新增 `src/mavlink/encoder.ts` 實現 `COMMAND_LONG` (#76) 封包編碼。
    - 支援 `MAV_CMD_SET_MESSAGE_INTERVAL` (#511) 動態設定指定訊息頻率（Hz / 微秒間隔）。
    - 支援 `MAV_CMD_REQUEST_MESSAGE` (#512) 執行單次 (1x) 封包即時採樣。
    - 新增「串流頻率設定面板 (`MessageRateModal`)」，提供實測接收 Hz 即時反饋、自選 0Hz/1Hz/2Hz/5Hz/10Hz/20Hz 與自訂 Message ID。
    - 提供「一鍵標準 GPS 頻率 (5Hz/1Hz)」、「高頻遙測 (10Hz)」與「全部停止 (0Hz)」快速按鈕。
  - **離線日誌重播**：支援拖曳載入 `.tlog`、`.bin`、`.csv`，具備播放/暫停、時間進度條與 1x/2x/5x/10x 倍速。
  - **GPS 模擬器**：內建靜態停放（含雜訊供測 CEP）、圓形航跡飛行與 RTK 狀態動態切換。
- **視覺化儀表與圖表**：
  - **Skyplot 天頂圖**：ECharts 極座標（Elevation & Azimuth）顯示衛星分佈，區分使用中與未使用的 PRN 標記。
  - **SNR 柱狀圖**：每顆衛星的 C/N0 訊號強度即時呈現。
  - **CEP 精度測量**：局部公尺級 ENU 2D 散佈圖，動態計算並繪製 CEP 50%（實線圓）、R95（虛線圓）、2DRMS（點線圓）與即時指標看板。
  - **Leaflet 2D 暗黑地圖**：即時航向箭頭、綠色飛行軌跡、圖層切換（Dark / OSM / Satellite）與視角跟隨。
  - **GPS 訊息全展開檢視器**：樹狀/表格列出所有 GPS 封包底層原始數值與工程單位解析值，外加飛控日誌文字終端。
  - **資料匯出**：一鍵將記憶體航跡匯出為 CSV、GeoJSON、KML。
- **專案建置與部署**：
  - Vite + TypeScript + TailwindCSS 產出純靜態檔案於 `dist/`，所有資源皆為相對路徑（`base: './'`），隨放即用。
  - 提供完整 `README.md`、`CHANGELOG.md` 與 GitHub Pages / Vercel / Nginx 部署指南。
  - 定義 100% 純前端無後端 (Zero Backend) 架構目標。
  - 明確規劃 MAVLink GPS 核心訊息解析清單與欄位展開規範。
  - 定義 CEP 50% / R95 / 2DRMS 演算法與局部座標投影計算式。
  - 定案極簡科技風格規範：黑底（`#000000`）、綠線條（`#00ff66`）、線框方塊無冗餘插圖。
- **專案文檔與部署指南 (`README.md`)**：
  - 撰寫完整的繁體中文專案說明與架構解析。
  - 詳盡的靜態編譯指南（編譯輸出目錄 `dist/`）。
  - 提供四大線上靜態部署教學：GitHub Pages (附 Actions CI/CD 工作流)、Cloudflare Pages / Vercel、傳統 Nginx 設定、Docker 容器化。
  - 記錄 Web Serial API 瀏覽器 HTTPS 安全上下文與 Linux 串口 dialout 權限注意事項。
- **變更日誌 (`CHANGELOG.md`)**：
  - 建立正式變更追蹤文檔。
