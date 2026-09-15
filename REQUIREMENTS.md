# MAVLink GPS Viewer - 需求規格與實現目標 (REQUIREMENTS)

本專案旨在打造一個專為 MAVLink 無人載具與 GNSS 模組設計的 **100% 純前端 (Zero Backend) 即時 GPS 遙測與精度分析儀表板**。

---

## 1. 系統架構與設計原則

1. **100% 純前端靜態應用程式 (Zero Backend)**：
   - 無需任何本機後端服務（無 Python/Node.js 後台常駐、無需資料庫）。
   - 支援直接透過靜態檔案伺服器（或 GitHub Pages、本機預覽）開啟即用。
2. **無狀態與記憶體暫存**：
   - 資料僅留存於瀏覽器記憶體中，關閉分頁或重新整理（F5）即刻清空重置，不留垃圾資料。
3. **極簡科技視覺風格 (Minimalist Cyber / Avionics HUD)**：
   - **核心基調**：純黑/深黑背景（`#000000` / `#0a0e0a`），搭配雷達螢光綠/軍規航電綠（`#00ff66` / `#00ff41` / `#10b981`）線條與方塊。
   - **設計原則**：無冗餘插圖、卡通圖示或花俏裝飾；完全以**幾何線條、邊框線框 (Wireframe)、網格 (Grid) 與資料方塊**構築界面，呈現硬核專業的航電終端儀表風格。
   - **字型風格**：數值與封包資料採用等寬字型（Monospace / JetBrains Mono / Roboto Mono），確保排版整齊清爽。

---

## 2. 資料來源與通訊能力 (Data Ingestion)

1. **Web Serial API 原生串口連線**：
   - 直接存取本機 Serial/UART 設備（如 `/dev/ttyUSB0`、`/dev/ttyACM0`、Windows `COMx`）。
   - 支援常用鮑率選單（9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600 等）與自訂鮑率。
   - 具備連線狀態指示燈（Connected / Disconnected / Receiving RX Indicator）。
2. **離線日誌檔解析與重播 (Offline Log Replay)**：
   - 支援拖曳或選擇本機檔案（`.tlog`、`.bin`、`.csv`）。
   - 提供播放進度條、暫停/播放、1x / 2x / 5x / 10x 倍速播放控制。
3. **GPS 模擬器 / 測試假資料注入 (GPS Simulator)**：
   - 內建假資料生成引擎，支援模擬靜態停放（附帶雜訊供測試 CEP）、圓形航跡飛行、RTK 狀態動態切換（No Fix $\to$ 3D $\to$ RTK Float $\to$ RTK Fix）。
   - 方便在無實體設備時進行全功能驗證與介面調試。

---

## 3. MAVLink GPS 相關封包解析規格

純 TypeScript 實現 MAVLink v1 / v2 串流解碼器（包含標頭同步字元 `0xFE`/`0xFD` 識別、Payload 解構、CRC-16 驗證），並全數支援以下 GPS 相關 Message：

| Msg ID | 訊息名稱 | 核心欄位與說明 | 介面呈現 |
|---|---|---|---|
| **#24** | `GPS_RAW_INT` | `fix_type`, `lat`, `lon`, `alt`, `eph` (HDOP\*100), `epv` (VDOP\*100), `vel`, `cog`, `satellites_visible`, `alt_ellipsoid`, `h_acc`, `v_acc`, `vel_acc`, `hdg_acc`, `yaw` | 即時數值面板、地圖定位點、航跡 |
| **#25** | `GPS_STATUS` | `satellites_visible`, `satellite_prn[20]`, `satellite_used[20]`, `satellite_elevation[20]`, `satellite_azimuth[20]`, `satellite_snr[20]` | **Skyplot 天頂極座標圖**、**SNR 柱狀圖**、衛星編號與使用標記 |
| **#124**| `GPS2_RAW` | 同 #24 欄位，對應次 GPS 接收器 | 雙 GPS 比對與狀態切換 |
| **#127**| `GPS_RTK` | `time_last_baseline_ms`, `rtk_receiver_id`, `wn`, `tow`, `rtk_health`, `rtk_rate`, `nsats`, `baseline_a_mm`, `baseline_b_mm`, `baseline_c_mm`, `accuracy`, `iar_num_hypotheses` | RTK 基準站資訊、基線向量、解算品質 |
| **#128**| `GPS2_RTK`| 副 RTK 接收器狀態 | 次 RTK 狀態監控 |
| **#33** | `GLOBAL_POSITION_INT` | `lat`, `lon`, `alt`, `relative_alt`, `vx`, `vy`, `vz`, `hdg` | EKF 融合後導航位置與地速向量 |
| **#232**| `GPS_INPUT` | 原始 GNSS 接收器輸入遙測（時間戳、訊號旗標等） | 原生感測器細部診斷 |
| **#113**| `HIL_GPS` | 軟體在環測試 GPS 注入訊息 | 模擬與回放通道 |
| **#253**| `STATUSTEXT` | 飛控發出的文字診斷日誌（如 GPS Glitch, RTK Acquired） | 終端文字日誌視窗 |

### 3.1 訊息全展開視窗 (Message Inspector)
- 提供樹狀/表格檢視器，收到任何 GPS 相關訊息時，可展開點選各 Message ID，列出所有底層原始欄位名稱、Raw 數值、工程單位解析值（如經緯度除以 1e7、高度除以 1e3）。

---

## 4. 核心視覺化元件

### 4.1 衛星天頂圖 (Skyplot) 與訊號強度 (SNR Chart)
- **Skyplot 天頂極座標圖**：
  - 黑色圓形網格，同心圓代表仰角（Elevation：$0^\circ$ 地平線至 $90^\circ$ 天頂）。
  - 輻射線代表方位角（Azimuth：$0^\circ$ 北、 $90^\circ$ 東、 $180^\circ$ 南、 $270^\circ$ 西）。
  - 衛星圖示：綠色線框圓形/方形節點標註 PRN 號碼，參與定位解算者 (`satellite_used=1`) 以實心/亮綠標示，未參與者以虛線/暗綠標示。
- **SNR / C/N0 柱狀圖**：
  - 橫軸為衛星 PRN 編號，縱軸為訊號強度 (dB-Hz)。
  - 綠色線框柱狀體，超過門檻值（如 35~40 dB-Hz）顯示高強度標記。

### 4.2 CEP (Circular Error Probable) 測量與分佈界面
- **座標轉換**：將收到的經緯度相對於基準點（支援「手動指定基準座標」或「自動計算歷史平均中心」）轉換為本地 ENU（East-North-Up）公尺座標。
- **2D 誤差散佈圖 (Scatter Plot)**：
  - 黑色方塊背景與綠色微米/公尺格線（例如 0.5m / 1.0m 刻度）。
  - 取樣點依時間序列漸變呈現（最新點為亮綠，舊點漸變為微暗綠）。
- **精度圓繪製**：
  - **CEP 50% 圓**（綠色實線圓）：涵蓋 50% 取樣點的半徑。
  - **R95 圓**（綠色虛線圓）：涵蓋 95% 取樣點的半徑。
  - **2DRMS 圓**（綠色點線圓）：$2 \times \sqrt{\sigma_x^2 + \sigma_y^2}$。
- **即時統計看板**：
  - 取樣點數 (Samples Count)、CEP(50%) 半徑、R95 半徑、2DRMS、最大偏差 (Max Error)、StdDev X、StdDev Y。
  - 一鍵清除統計 (Reset CEP) 與凍結/暫停採樣按鈕。

### 4.3 2D 地圖即時航跡
- 使用 Leaflet，支援自訂深色/暗黑向量圖資（CartoDB Dark Matter / OpenStreetMap）與衛星影像底圖切換。
- 目前航向箭頭、即時定位點與歷史綠色航跡線。
- 地圖右上方整合簡易圖層與視角置中跟隨切換按鈕。

### 4.4 航跡資料匯出
- 支援將瀏覽器記憶體中收集的航跡與取樣點一鍵匯出為：
  - **CSV**（包含時間、緯度、經度、海拔、HDOP、VDOP、Sats、FixType、速度）。
  - **GeoJSON**（供 GIS 軟體直接載入）。
  - **KML**（供 Google Earth 檢視 3D 航跡）。

---

## 5. 技術選型

| 領域 | 選定技術 | 說明 |
|---|---|---|
| **專案建置** | **Vite + TypeScript** | 輕量極速、原生 ES 模組、嚴格型別定義 |
| **UI 核心框架** | **React 18** | 元件化設計、React Hooks 反應式狀態流 |
| **樣式系統** | **TailwindCSS** | 實現「黑底、綠線框、科技幾何方塊」自訂主題 |
| **圖示庫** | **Lucide React** | 純線條風格圖示（與綠色線框風格完美契合） |
| **專業圖表** | **Apache ECharts** | 繪製 Skyplot 極座標天頂圖、SNR 柱狀圖、CEP 2D 散佈圖 |
| **地圖元件** | **Leaflet** | 輕量高效 2D 地圖、支援自訂深色底圖與軌跡渲染 |
| **MAVLink 引擎** | **自建 TypeScript Parser** | 零相依、跨平台支援 MAVLink v1/v2 串流狀態機 |

---

## 6. 專案開發里程碑 (Milestones)

1. **階段一：專案架構建立與 Cyber-Green 主題配置**
   - 初始化 Vite + React + TS + TailwindCSS 專案。
   - 配置深黑底（`#000000`）、航電綠（`#00ff66`）、線框方塊自訂樣式系統。
2. **階段二：MAVLink 串流解碼器與資料源抽象層**
   - 實現 MAVLink v1/v2 二進制解碼器狀態機。
   - 實現 Web Serial API 連線控制器、日誌檔 Replay 控制器與內建假資料生成器。
3. **階段三：核心視覺化元件開發**
   - 實現 Skyplot 極座標天頂圖與 SNR 柱狀圖。
   - 實現 CEP 精度計算引擎與 2D 散佈同心圓介面。
   - 實現 MAVLink GPS 訊息全欄位即時展開檢視面板。
4. **階段四：地圖整合與資料匯出**
   - 整合 Leaflet 暗色風格地圖與即時航跡線。
   - 實現 CSV / GeoJSON / KML 匯出功能。
5. **階段五：整合測試與優化**
   - 使用模擬器與實測串口封包進行連線壓力與記憶體洩漏測試。
