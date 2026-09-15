# MAVLink GPS Viewer

[![License: MIT](https://img.shields.io/badge/License-MIT-00ff66.svg?style=flat-square)](LICENSE)
[![Architecture: 100% Pure Frontend](https://img.shields.io/badge/Architecture-100%25%20Pure%20Frontend-00ff66.svg?style=flat-square)]()
[![Theme: Cyber--Tactical HUD](https://img.shields.io/badge/Theme-Cyber--Tactical%20HUD-000000.svg?style=flat-square&color=00ff66)]()

一個專為 MAVLink 協定設計的 **100% 純前端 (Zero Backend) 即時 GPS 遙測與精度分析儀表板**。

無須安裝任何後端服務、Python 或本機資料庫，直接於現代瀏覽器中開啟即用；關閉或重新整理網頁時自動清空記憶體重置。

---

## 📸 介面設計理念 (Cyber-Tactical HUD)

* **色彩基調**：極致純黑背景（`#000000` / `#0a0e0a`）搭配航電雷達螢光綠（`#00ff66` / `#00ff41`）。
* **極簡幾何線框**：摒棄所有冗餘的插圖、卡通圖片與花俏陰影，完全以**精確的幾何線條、邊框線框 (Wireframe)、格網 (Grid) 與直角資料方塊**構築界面。
* **數據字型**：所有數值、時間與封包資料採用等寬字型（Monospace），呈現硬核專業的軍規航電終端儀表風格。

---

## ⚡ 核心功能

1. **多樣化資料輸入來源 (Data Sources)**：
   - **Web Serial API 原生串口連線**：直接存取本機 `/dev/ttyUSB*`、`/dev/ttyACM*`、Windows `COMx` 等串口設備，支援 9600 至 921600 等常見鮑率。
   - **離線日誌檔解析與重播 (Log Replay)**：支援拖曳匯入 `.tlog`、`.bin`、`.csv`，具備播放進度條、暫停與倍速控制。
   - **內建 GPS 模擬器**：支援靜態停放雜訊測試、圓形航跡飛行、動態切換 RTK 狀態。
2. **MAVLink GPS 相關封包全解析**：
   - 支援 MAVLink v1 / v2 二進制串流解碼與 CRC-16 檢驗。
   - 完整支援所有 GPS 相關 Message：
     - `#24 GPS_RAW_INT` / `#124 GPS2_RAW`：主/副 GPS 經緯度、海拔、HDOP、VDOP、精度指標
     - `#25 GPS_STATUS`：20 顆衛星 PRN、仰角、方位角、訊號強度 (SNR)、使用標記
     - `#33 GLOBAL_POSITION_INT`：EKF 融合後導航座標與速度
     - `#127 GPS_RTK` / `#128 GPS2_RTK`：RTK 基準站、基線向量、解算品質
     - `#232 GPS_INPUT` / `#113 HIL_GPS` / `#253 STATUSTEXT`
   - **訊息全展開檢視器 (Message Inspector)**：即時檢視所有收到封包的底層原始欄位與工程解析值。
3. **衛星天頂圖 (Skyplot) 與訊號強度 (SNR)**：
   - **Skyplot 極座標天頂圖**：仰角（Elevation：$0^\circ \sim 90^\circ$）與方位角（Azimuth：$0^\circ \sim 360^\circ$），綠色幾何節點標註 PRN 與定位使用狀態。
   - **SNR 柱狀圖**：每顆衛星之 PRN 與訊號品質強度 (dB-Hz)。
4. **CEP (Circular Error Probable) 測量面板**：
   - 即時將 WGS84 座標投影至本地公尺級 ENU 平面。
   - 繪製 2D 平面散佈圖（依時間漸層顯示取樣點）。
   - 計算並標示 **CEP 50% 圓**（實線）、**R95 圓**（虛線）、**2DRMS 圓**（點線）。
   - 即時統計看板：取樣數、最大誤差、標準差、CEP 半徑。
5. **2D 地圖與航跡追蹤**：
   - 暗色主題向量地圖與衛星影像切換。
   - 即時定位點箭頭與綠色飛行軌跡渲染。
6. **航跡資料匯出**：
   - 一鍵匯出瀏覽器記憶體中的航跡為 **CSV**、**GeoJSON**、**KML**。

---

## 🛠️ 技術棧 (Tech Stack)

* **框架**：React 18 + TypeScript + Vite
* **樣式**：TailwindCSS + Lucide React（純線條圖示）
* **圖表**：Apache ECharts（Skyplot 極座標、CEP 散佈圖、SNR 柱狀圖）
* **地圖**：Leaflet
* **MAVLink 解碼引擎**：純 TypeScript 自研輕量狀態機（Zero Backend）

---

## 💻 本地開發與編譯 (Development & Build)

### 1. 環境需求
* Node.js >= 18.0.0
* npm >= 9.0.0 (或 pnpm / yarn)

### 2. 安裝相依套件
```bash
npm install
```

### 3. 啟動本地開發伺服器 (已內建自動 HTTPS)
```bash
npm run dev
```
啟動後終端機將提供 HTTPS 加密網址：
- 本機訪問：`https://localhost:5173/`
- 區域網路訪問：`https://<你的IP>:5173/`

> **🔐 HTTPS 憑證說明**：
> 專案已配置 `@vitejs/plugin-basic-ssl` 自動生成本機 HTTPS 憑證。第一次開啟時，Chrome 會提示「您的連線不是私人連線」，請點選 **「進階 (Advanced)」$\to$「繼續前往 (Proceed)」** 即可進入。進入後即為標準 **Secure Context (安全上下文)**，Web Serial API 即可正常使用。

### 4. 編譯與預覽生產環境 (亦支援 HTTPS)
```bash
npm run build
npm run preview
```
啟動後將於 `https://localhost:4173/` 提供已編譯之靜態網頁預覽。

---

## 🚀 靜態網頁線上部署教學 (Deployment Guide)

由於本專案為 **100% 純前端無後端** 架構，編譯產出的 `dist/` 資料夾由標準 HTML、CSS、JS 與資源檔構成，可隨意部署至任何靜態託管平台。

### 方法 1：GitHub Pages (免費自動化部署，推薦)
本專案已設定相對路徑支援（`base: './'`），非常適合直接託管於 GitHub Pages。

1. 在專案中建立 `.github/workflows/deploy.yml`：
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ master, main ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
2. 前往 GitHub Repo 的 **Settings -> Pages**，將 Source 設定為 **GitHub Actions**。
3. 每次推送到 `master` 或 `main` 分支時，將自動編譯並部署至 `https://<username>.github.io/<repo-name>/`。

---

### 方法 2：Cloudflare Pages / Vercel / Netlify
1. 將專案推送到 GitHub / GitLab。
2. 在 Cloudflare Pages / Vercel / Netlify 建立新專案，綁定 Git 倉庫。
3. 專案設定填入：
   - **Framework Preset**：`Vite`
   - **Build Command**：`npm run build`
   - **Output Directory**：`dist`
4. 點擊 Deploy，數秒內即可全球 CDN 上線（自帶 HTTPS，完美支援 Web Serial API）。

---

### 方法 3：傳統 Nginx 伺服器部署
1. 在本地或 CI/CD 執行編譯：
   ```bash
   npm run build
   ```
2. 將 `dist/` 資料夾內的所有檔案上傳至伺服器（例如 `/var/www/mav_gps_viewer`）。
3. Nginx 設定檔範例 (`/etc/nginx/sites-available/mav_gps_viewer.conf`)：
   ```nginx
   server {
       listen 80;
       server_name gps.yourdomain.com;
       # 建議配置 HTTPS 證書 (Web Serial API 必須在 HTTPS 下運作)
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name gps.yourdomain.com;

       ssl_certificate /path/to/fullchain.pem;
       ssl_certificate_key /path/to/privkey.pem;

       root /var/www/mav_gps_viewer;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # 靜態資源快取
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }
   ```
4. 重啟 Nginx：`sudo systemctl reload nginx`。

---

### 方法 4：Docker + Nginx 容器化
若需包裝成 Docker 映像檔，可在專案根目錄建立 `Dockerfile`：
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
執行建置與啟動：
```bash
docker build -t mav-gps-viewer .
docker run -d -p 8080:80 --name mav-gps-viewer mav-gps-viewer
```

---

## 🔒 瀏覽器權限與安全注意事項

1. **Web Serial API 安全環境需求**：
   - 瀏覽器安全性規範要求 Web Serial API 必須在 **`localhost`** 或 **`https://` (安全上下文)** 中才能呼叫。若部署在未加密的 `http://` 網址（非 localhost），瀏覽器會自動停用 Serial 按鈕。
2. **Linux 串口權限 (Dialout 權限組)**：
   - 在 Linux 系統存取 `/dev/ttyUSB0` 或 `/dev/ttyACM0`，使用者帳號需隸屬於 `dialout` 群組：
     ```bash
     sudo usermod -aG dialout $USER
     # 設定後需重新登入使權限生效
     ```

---

## 📄 授權協議 (License)

本專案採用 [MIT License](LICENSE) 授權。
