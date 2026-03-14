# 📊 IDX Screener Pro

**Tool screening saham Indonesia real-time** dengan analisis teknikal komprehensif, bandarmology, money flow, dan prediksi harga berbasis data.

![Python](https://img.shields.io/badge/Backend-Python%20FastAPI-009688?style=flat-square&logo=fastapi)
![Vite](https://img.shields.io/badge/Frontend-Vite-646CFF?style=flat-square&logo=vite)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| 📈 **Analisis Teknikal** | RSI, MACD, Bollinger Bands, Stochastic, ADX, MFI, CCI, Williams %R, Ichimoku, dan lainnya |
| 📊 **Interactive Chart** | Candlestick chart real-time dengan overlay SMA, Bollinger Bands (Lightweight Charts) |
| 🎯 **Entry Point** | Kalkulasi support/resistance, pivot points, stop loss, target harga, dan risk/reward ratio |
| 🏦 **Bandarmology** | Deteksi akumulasi/distribusi bandar, smart money tracking, unusual volume |
| 💰 **Money Flow** | Analisis aliran dana asing vs domestik, OBV, VWAP |
| 🔮 **EOD Prediksi** | Prediksi pergerakan harga berdasarkan skor multi-indikator |
| 🔍 **Stock Screener** | Filter saham berdasarkan sinyal, sektor, RSI, fase bandar, dan entry point |
| 🕯️ **Candlestick Patterns** | Deteksi pola: Hammer, Engulfing, Morning/Evening Star, Three White Soldiers, dll |

## 🏗️ Tech Stack

### Backend (Python)
- **FastAPI** — REST API backend
- **yfinance** — Data saham real-time dari Yahoo Finance
- **pandas** — Manipulasi data time-series
- **ta** — Library indikator teknikal (Technical Analysis)
- **NumPy** — Komputasi numerik

### Frontend (JavaScript)
- **Vite** — Build tool & dev server
- **Lightweight Charts** by TradingView — Interactive candlestick chart
- **Vanilla JS** — Tanpa framework, modular ES modules

## 📁 Struktur Proyek

```
screeningtorray/
├── server.py              # Python FastAPI backend (analisis utama)
├── server.js              # Node.js backend (legacy fallback)
├── index.html             # Entry point HTML
├── package.json           # Dependencies & scripts
├── .gitignore
├── src/
│   ├── main.js            # Aplikasi utama, layout, chart, UI
│   ├── api.js             # API client (fetch data dari backend)
│   ├── indicators.js      # Kalkulasi indikator teknikal (JS fallback)
│   ├── bandarmology.js    # Smart money & bandar tracking
│   ├── screening.js       # Stock screener & entry point calculator
│   ├── eod.js             # End-of-day analysis & prediksi
│   └── style.css          # Styling (dark theme, responsive)
```

## 🚀 Cara Menjalankan

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.9
- **pip** (Python package manager)

### 1. Clone Repository

```bash
git clone https://github.com/<username>/screeningtorray.git
cd screeningtorray
```

### 2. Install Dependencies

```bash
# Frontend dependencies
npm install

# Python virtual environment & dependencies
python -m venv .venv
source .venv/bin/activate          # Linux/Mac
# .venv\Scripts\activate           # Windows

pip install fastapi uvicorn yfinance pandas numpy ta
```

### 3. Jalankan Aplikasi

**Opsi A — Jalankan sekaligus (backend + frontend):**

```bash
npm run start
```

**Opsi B — Jalankan terpisah (recommended untuk development):**

```bash
# Terminal 1: Python backend (port 3001)
npm run server
# atau langsung:
# .venv/bin/python server.py

# Terminal 2: Vite dev server (port 5173)
npm run dev
```

Buka browser di **http://localhost:5173**

## 🔌 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/chart/{symbol}` | Data OHLCV untuk chart |
| `GET` | `/api/quote?symbols=...` | Quote real-time (multi-symbol) |
| `GET` | `/api/search?q=...` | Cari saham IDX |
| `GET` | `/api/idx-stocks` | Daftar semua saham IDX |
| `GET` | `/api/analyze/{symbol}` | Full technical analysis |

**Contoh:**

```bash
# Quote saham BBCA
curl http://localhost:3001/api/quote?symbols=BBCA.JK

# Analisis teknikal TLKM
curl http://localhost:3001/api/analyze/TLKM.JK
```

## 📋 Saham yang Didukung

Mendukung **100+ saham IDX** dari berbagai sektor:

| Sektor | Contoh Saham |
|--------|-------------|
| Finance | BBCA, BBRI, BMRI, BBNI, BRIS |
| Consumer | UNVR, HMSP, ICBP, INDF, MYOR |
| Mining | ADRO, PTBA, ANTM, INCO, MDKA |
| Telekomunikasi | TLKM, EXCL, ISAT |
| Technology | GOTO, BUKA, EMTK |
| Property | BSDE, CTRA, SMRA, PWON |
| Infrastruktur | SMGR, WIKA, JSMR |
| Dan lainnya... | Otomotif, Energy, Retail, Agrikultur, Transportation |

## 🛠️ Scripts

| Script | Perintah | Deskripsi |
|--------|----------|-----------|
| Dev Server | `npm run dev` | Jalankan Vite dev server |
| Python Backend | `npm run server` | Jalankan FastAPI backend |
| Node Backend | `npm run server:node` | Jalankan Node.js backend (legacy) |
| Start All | `npm run start` | Jalankan backend + frontend |
| Build | `npm run build` | Build production bundle |
| Preview | `npm run preview` | Preview production build |

## 📸 Screenshots

> _Coming soon_

## 🤝 Contributing

1. Fork repository ini
2. Buat branch fitur (`git checkout -b feature/fitur-baru`)
3. Commit perubahan (`git commit -m 'Tambah fitur baru'`)
4. Push ke branch (`git push origin feature/fitur-baru`)
5. Buat Pull Request

## ⚠️ Disclaimer

> Aplikasi ini hanya untuk **edukasi dan riset**. Bukan merupakan rekomendasi investasi. Keputusan investasi sepenuhnya tanggung jawab pengguna. Selalu lakukan riset mandiri sebelum melakukan transaksi saham.

## 📄 License

MIT License — Lihat file [LICENSE](LICENSE) untuk detail.

---

<p align="center">
  Dibuat dengan ❤️ untuk komunitas investor Indonesia
</p>
