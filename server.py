"""
server.py — Python FastAPI Backend untuk IDX Screener Pro
==========================================================
Analisis teknikal menggunakan pandas + ta library (lebih akurat dari JavaScript)
Data dari yfinance (library resmi Yahoo Finance)
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import yfinance as yf
import pandas as pd
import numpy as np
import ta
import json

app = FastAPI(title="IDX Screener Backend", version="2.0")

# CORS — allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cache ────────────────────────────────────────────────────

_cache = {}
CACHE_TTL = 60  # seconds

def get_cached(key):
    entry = _cache.get(key)
    if entry and (datetime.now() - entry["ts"]).seconds < CACHE_TTL:
        return entry["data"]
    return None

def set_cache(key, data):
    _cache[key] = {"data": data, "ts": datetime.now()}

# ── Sector mapping ───────────────────────────────────────────

SECTOR_MAP = {
    "Finance": ["BBCA","BBRI","BMRI","BBNI","BRIS","ARTO","BNGA","BDMN","MEGA","BTPS","NISP","BBTN","BJTM","BJBR","BTPN","BBYB"],
    "Consumer": ["UNVR","HMSP","GGRM","ICBP","INDF","MYOR","KLBF","SIDO","KAEF","DVLA","TSPC","ULTJ","CLEO","ADES"],
    "Mining": ["ADRO","PTBA","ANTM","INCO","MDKA","TINS","ITMG","BUMI","DSSA","HRUM","MBAP"],
    "Telekomunikasi": ["TLKM","EXCL","ISAT","FREN","TOWR","TBIG","MTEL"],
    "Otomotif": ["ASII","AUTO","GJTL","SMSM","IMAS"],
    "Infrastruktur": ["SMGR","WIKA","JSMR","WSKT","PTPP","ADHI","WTON","SMBR"],
    "Energy": ["PGAS","MEDC","AKRA","ELSA","RAJA"],
    "Technology": ["GOTO","BUKA","EMTK","DCII","ATIC"],
    "Property": ["BSDE","CTRA","SMRA","LPKR","PWON","DMAS","MKPI","DILD"],
    "Retail": ["ACES","MAPI","ERAA","RALS","LPPF","AMRT"],
    "Agrikultur": ["CPIN","JPFA","MAIN","AALI","LSIP","SMAR","TBLA"],
    "Transportation": ["ASSA","BIRD","GIAA","SMDR","TMAS"],
}

STOCK_NAMES = {
    "BBCA": "Bank Central Asia", "BBRI": "Bank Rakyat Indonesia", "BMRI": "Bank Mandiri",
    "BBNI": "Bank Negara Indonesia", "BRIS": "Bank Syariah Indonesia", "ARTO": "Bank Jago",
    "BBTN": "Bank Tabungan Negara", "BNGA": "Bank CIMB Niaga", "BDMN": "Bank Danamon",
    "MEGA": "Bank Mega", "BTPS": "Bank BTPN Syariah", "NISP": "Bank OCBC NISP",
    "BJTM": "Bank Jatim", "BJBR": "Bank BJB",
    "TLKM": "Telkom Indonesia", "EXCL": "XL Axiata", "ISAT": "Indosat Ooredoo",
    "TOWR": "Sarana Menara Nusantara", "TBIG": "Tower Bersama",
    "ASII": "Astra International", "AUTO": "Astra Otoparts",
    "UNVR": "Unilever Indonesia", "HMSP": "HM Sampoerna", "GGRM": "Gudang Garam",
    "ICBP": "Indofood CBP", "INDF": "Indofood Sukses Makmur", "MYOR": "Mayora Indah",
    "KLBF": "Kalbe Farma", "SIDO": "Industri Jamu Sido",
    "CPIN": "Charoen Pokphand", "JPFA": "Japfa Comfeed", "AALI": "Astra Agro Lestari",
    "ADRO": "Adaro Energy", "PTBA": "Bukit Asam", "ANTM": "Aneka Tambang",
    "INCO": "Vale Indonesia", "MDKA": "Merdeka Copper Gold", "TINS": "Timah",
    "ITMG": "Indo Tambangraya Megah", "HRUM": "Harum Energy", "BUMI": "Bumi Resources",
    "PGAS": "Perusahaan Gas Negara", "MEDC": "Medco Energi", "AKRA": "AKR Corporindo",
    "SMGR": "Semen Indonesia", "WIKA": "Wijaya Karya", "JSMR": "Jasa Marga",
    "WSKT": "Waskita Karya", "PTPP": "PP (Persero)", "ADHI": "Adhi Karya",
    "GOTO": "GoTo Gojek Tokopedia", "BUKA": "Bukalapak", "EMTK": "Elang Mahkota Teknologi",
    "BSDE": "Bumi Serpong Damai", "CTRA": "Ciputra Development", "SMRA": "Summarecon Agung",
    "PWON": "Pakuwon Jati",
    "ACES": "Ace Hardware Indonesia", "MAPI": "Mitra Adiperkasa", "ERAA": "Erajaya",
    "AMRT": "Sumber Alfaria Trijaya", "LPPF": "Matahari Dept Store",
    "ASSA": "Adi Sarana Armada", "BIRD": "Blue Bird",
    "FREN": "Smartfren Telecom", "MTEL": "Dayamitra Telekomunikasi",
}

def get_sector(symbol: str) -> str:
    sym = symbol.replace(".JK", "")
    for sector, symbols in SECTOR_MAP.items():
        if sym in symbols:
            return sector
    return "Lainnya"


# ── Data Fetching ────────────────────────────────────────────

def fetch_stock_data(symbol: str, period: str = "6mo") -> pd.DataFrame:
    """Fetch OHLCV data using yfinance"""
    cache_key = f"data_{symbol}_{period}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval="1d")
        if df.empty:
            return None
        # Clean column names
        df.columns = [c.lower().replace(' ', '_') for c in df.columns]
        df = df.rename(columns={"stock_splits": "splits"})
        set_cache(cache_key, df)
        return df
    except Exception as e:
        print(f"Fetch error [{symbol}]: {e}")
        return None


def compute_technical_indicators(df: pd.DataFrame) -> dict:
    """Calculate ALL technical indicators using ta library (pandas-based)"""
    if df is None or len(df) < 20:
        return None

    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    result = {}

    # ── Moving Averages ──
    result["sma5"] = ta.trend.sma_indicator(close, window=5).tolist()
    result["sma10"] = ta.trend.sma_indicator(close, window=10).tolist()
    result["sma20"] = ta.trend.sma_indicator(close, window=20).tolist()
    result["sma50"] = ta.trend.sma_indicator(close, window=50).tolist()
    result["sma200"] = ta.trend.sma_indicator(close, window=200).tolist()
    result["ema12"] = ta.trend.ema_indicator(close, window=12).tolist()
    result["ema26"] = ta.trend.ema_indicator(close, window=26).tolist()

    # ── RSI ──
    rsi_series = ta.momentum.rsi(close, window=14)
    result["rsi"] = rsi_series.tolist()

    # ── MACD ──
    macd_obj = ta.trend.MACD(close, window_slow=26, window_fast=12, window_sign=9)
    result["macd"] = macd_obj.macd().tolist()
    result["macd_signal"] = macd_obj.macd_signal().tolist()
    result["macd_histogram"] = macd_obj.macd_diff().tolist()

    # ── Bollinger Bands ──
    bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
    result["bb_upper"] = bb.bollinger_hband().tolist()
    result["bb_middle"] = bb.bollinger_mavg().tolist()
    result["bb_lower"] = bb.bollinger_lband().tolist()
    result["bb_pband"] = bb.bollinger_pband().tolist()

    # ── Stochastic ──
    stoch = ta.momentum.StochasticOscillator(high, low, close, window=14, smooth_window=3)
    result["stoch_k"] = stoch.stoch().tolist()
    result["stoch_d"] = stoch.stoch_signal().tolist()

    # ── ADX ──
    adx = ta.trend.ADXIndicator(high, low, close, window=14)
    result["adx"] = adx.adx().tolist()
    result["adx_pos"] = adx.adx_pos().tolist()
    result["adx_neg"] = adx.adx_neg().tolist()

    # ── MFI ──
    result["mfi"] = ta.volume.money_flow_index(high, low, close, volume, window=14).tolist()

    # ── OBV ──
    result["obv"] = ta.volume.on_balance_volume(close, volume).tolist()

    # ── VWAP ──
    result["vwap"] = ta.volume.volume_weighted_average_price(high, low, close, volume).tolist()

    # ── ATR ──
    result["atr"] = ta.volatility.average_true_range(high, low, close, window=14).tolist()

    # ── CCI ──
    result["cci"] = ta.trend.cci(high, low, close, window=20).tolist()

    # ── Williams %R ──
    result["williams_r"] = ta.momentum.williams_r(high, low, close, lbp=14).tolist()

    # ── Ichimoku ──
    try:
        ichimoku = ta.trend.IchimokuIndicator(high, low, window1=9, window2=26, window3=52)
        result["ichimoku_a"] = ichimoku.ichimoku_a().tolist()
        result["ichimoku_b"] = ichimoku.ichimoku_b().tolist()
        result["ichimoku_base"] = ichimoku.ichimoku_base_line().tolist()
        result["ichimoku_conv"] = ichimoku.ichimoku_conversion_line().tolist()
    except:
        pass

    # Replace NaN with None for JSON
    for key in result:
        result[key] = [None if (isinstance(v, float) and np.isnan(v)) else v for v in result[key]]

    return result


def detect_candle_patterns(df: pd.DataFrame) -> list:
    """Detect candlestick patterns from pandas data"""
    if len(df) < 3:
        return []

    patterns = []
    c = df.iloc[-1]
    p = df.iloc[-2]
    pp = df.iloc[-3]

    body_c = abs(c["close"] - c["open"])
    range_c = c["high"] - c["low"]
    body_p = abs(p["close"] - p["open"])
    range_p = p["high"] - p["low"]
    upper_wick = c["high"] - max(c["open"], c["close"])
    lower_wick = min(c["open"], c["close"]) - c["low"]
    is_bull_c = c["close"] > c["open"]
    is_bear_c = c["close"] < c["open"]
    is_bull_p = p["close"] > p["open"]
    is_bear_p = p["close"] < p["open"]

    # Hammer
    if range_c > 0 and lower_wick > body_c * 2 and upper_wick < body_c * 0.3:
        patterns.append({"name": "Hammer", "type": "bullish", "strength": 7,
                        "desc": "Potensi reversal naik — buyer dominan di akhir sesi"})

    # Inverted Hammer
    if range_c > 0 and upper_wick > body_c * 2 and lower_wick < body_c * 0.3 and is_bull_c:
        patterns.append({"name": "Inverted Hammer", "type": "bullish", "strength": 5,
                        "desc": "Potensi reversal naik — harus dikonfirmasi besok"})

    # Shooting Star
    if upper_wick > body_c * 2 and lower_wick < body_c * 0.3 and is_bear_c:
        patterns.append({"name": "Shooting Star", "type": "bearish", "strength": 7,
                        "desc": "Potensi reversal turun — seller kuat di puncak"})

    # Doji
    if range_c > 0 and body_c < range_c * 0.1:
        patterns.append({"name": "Doji", "type": "neutral", "strength": 6,
                        "desc": "Market ragu-ragu — tunggu konfirmasi arah besok"})

    # Bullish Engulfing
    if is_bull_c and is_bear_p and c["open"] <= p["close"] and c["close"] >= p["open"] and body_c > body_p:
        patterns.append({"name": "Bullish Engulfing", "type": "bullish", "strength": 8,
                        "desc": "Sinyal kuat — buyer mengambil alih, potensi naik besok"})

    # Bearish Engulfing
    if is_bear_c and is_bull_p and c["open"] >= p["close"] and c["close"] <= p["open"] and body_c > body_p:
        patterns.append({"name": "Bearish Engulfing", "type": "bearish", "strength": 8,
                        "desc": "Sinyal kuat — seller mengambil alih, potensi turun besok"})

    # Morning Star
    body_pp = abs(pp["close"] - pp["open"])
    if (pp["close"] < pp["open"] and body_pp > range_p * 0.3 and
        body_p < body_pp * 0.3 and is_bull_c and c["close"] > (pp["open"] + pp["close"]) / 2):
        patterns.append({"name": "Morning Star", "type": "bullish", "strength": 9,
                        "desc": "Pola 3 candle reversal — sinyal paling kuat untuk naik"})

    # Evening Star
    if (pp["close"] > pp["open"] and body_pp > range_p * 0.3 and
        body_p < body_pp * 0.3 and is_bear_c and c["close"] < (pp["open"] + pp["close"]) / 2):
        patterns.append({"name": "Evening Star", "type": "bearish", "strength": 9,
                        "desc": "Pola 3 candle reversal — sinyal paling kuat untuk turun"})

    # Three White Soldiers
    if (is_bull_c and is_bull_p and pp["close"] > pp["open"] and
        c["close"] > p["close"] and p["close"] > pp["close"]):
        patterns.append({"name": "Three White Soldiers", "type": "bullish", "strength": 9,
                        "desc": "3 candle naik berturut — tren naik kuat"})

    # Three Black Crows
    if (is_bear_c and is_bear_p and pp["close"] < pp["open"] and
        c["close"] < p["close"] and p["close"] < pp["close"]):
        patterns.append({"name": "Three Black Crows", "type": "bearish", "strength": 9,
                        "desc": "3 candle turun berturut — tekanan jual kuat"})

    return patterns


def generate_technical_summary(indicators: dict, df: pd.DataFrame) -> dict:
    """Generate buy/sell signal from all indicators"""
    n = len(df)
    last = n - 1
    buy_signals = 0
    sell_signals = 0
    details = []

    # RSI
    rsi = indicators.get("rsi", [None])[last] if last < len(indicators.get("rsi", [])) else None
    if rsi is not None:
        if rsi < 30:
            buy_signals += 2
            details.append({"name": "RSI", "value": f"{rsi:.1f}", "signal": "BUY", "desc": "Oversold"})
        elif rsi < 40:
            buy_signals += 1
            details.append({"name": "RSI", "value": f"{rsi:.1f}", "signal": "BUY", "desc": "Mendekati oversold"})
        elif rsi > 70:
            sell_signals += 2
            details.append({"name": "RSI", "value": f"{rsi:.1f}", "signal": "SELL", "desc": "Overbought"})
        elif rsi > 60:
            sell_signals += 1
            details.append({"name": "RSI", "value": f"{rsi:.1f}", "signal": "SELL", "desc": "Mendekati overbought"})
        else:
            details.append({"name": "RSI", "value": f"{rsi:.1f}", "signal": "NEUTRAL", "desc": "Netral"})

    # MACD
    macd_h = indicators.get("macd_histogram", [None])
    if last < len(macd_h) and macd_h[last] is not None:
        h_now = macd_h[last]
        h_prev = macd_h[last - 1] if last > 0 and macd_h[last-1] is not None else 0
        macd_val = indicators["macd"][last] if last < len(indicators.get("macd",[])) else 0
        if h_now > 0 and h_prev <= 0:
            buy_signals += 2
            details.append({"name": "MACD", "value": f"{macd_val:.2f}", "signal": "BUY", "desc": "Bullish crossover"})
        elif h_now < 0 and h_prev >= 0:
            sell_signals += 2
            details.append({"name": "MACD", "value": f"{macd_val:.2f}", "signal": "SELL", "desc": "Bearish crossover"})
        elif h_now > 0:
            buy_signals += 1
            details.append({"name": "MACD", "value": f"{macd_val:.2f}", "signal": "BUY", "desc": "Bullish"})
        else:
            sell_signals += 1
            details.append({"name": "MACD", "value": f"{macd_val:.2f}", "signal": "SELL", "desc": "Bearish"})

    # SMA Cross
    sma20 = indicators.get("sma20", [None])
    sma50 = indicators.get("sma50", [None])
    close = df["close"].iloc[last]
    if last < len(sma20) and last < len(sma50) and sma20[last] is not None and sma50[last] is not None:
        if sma20[last] > sma50[last] and (last == 0 or sma20[last-1] is None or sma20[last-1] <= sma50[last-1]):
            buy_signals += 3
            details.append({"name": "Golden Cross", "value": f"SMA20: {sma20[last]:.0f}", "signal": "BUY", "desc": "SMA20 > SMA50"})
        elif sma20[last] < sma50[last] and (last == 0 or sma20[last-1] is None or sma20[last-1] >= sma50[last-1]):
            sell_signals += 3
            details.append({"name": "Death Cross", "value": f"SMA20: {sma20[last]:.0f}", "signal": "SELL", "desc": "SMA20 < SMA50"})
        if close > sma20[last]:
            buy_signals += 1
            details.append({"name": "Price vs SMA20", "value": f"{close:.0f}", "signal": "BUY", "desc": "Di atas SMA20"})
        else:
            sell_signals += 1
            details.append({"name": "Price vs SMA20", "value": f"{close:.0f}", "signal": "SELL", "desc": "Di bawah SMA20"})

    # Bollinger Bands
    bb_u = indicators.get("bb_upper", [None])
    bb_l = indicators.get("bb_lower", [None])
    if last < len(bb_u) and bb_u[last] is not None:
        if close <= bb_l[last]:
            buy_signals += 2
            details.append({"name": "Bollinger", "value": f"{close:.0f}", "signal": "BUY", "desc": "Menyentuh lower band"})
        elif close >= bb_u[last]:
            sell_signals += 2
            details.append({"name": "Bollinger", "value": f"{close:.0f}", "signal": "SELL", "desc": "Menyentuh upper band"})
        else:
            details.append({"name": "Bollinger", "value": f"{close:.0f}", "signal": "NEUTRAL", "desc": "Dalam band"})

    # Stochastic
    sk = indicators.get("stoch_k", [None])
    sd = indicators.get("stoch_d", [None])
    if last < len(sk) and sk[last] is not None:
        if sk[last] < 20:
            buy_signals += 2
            details.append({"name": "Stochastic", "value": f"{sk[last]:.1f}", "signal": "BUY", "desc": "Oversold"})
        elif sk[last] > 80:
            sell_signals += 2
            details.append({"name": "Stochastic", "value": f"{sk[last]:.1f}", "signal": "SELL", "desc": "Overbought"})
        else:
            details.append({"name": "Stochastic", "value": f"{sk[last]:.1f}", "signal": "NEUTRAL", "desc": "Netral"})

    # MFI
    mfi = indicators.get("mfi", [None])
    if last < len(mfi) and mfi[last] is not None:
        if mfi[last] < 20:
            buy_signals += 1
            details.append({"name": "MFI", "value": f"{mfi[last]:.1f}", "signal": "BUY", "desc": "Oversold"})
        elif mfi[last] > 80:
            sell_signals += 1
            details.append({"name": "MFI", "value": f"{mfi[last]:.1f}", "signal": "SELL", "desc": "Overbought"})
        else:
            details.append({"name": "MFI", "value": f"{mfi[last]:.1f}", "signal": "NEUTRAL", "desc": "Netral"})

    # ADX
    adx_val = indicators.get("adx", [None])
    adx_pos = indicators.get("adx_pos", [None])
    adx_neg = indicators.get("adx_neg", [None])
    if (last < len(adx_val) and adx_val[last] is not None and
        last < len(adx_pos) and adx_pos[last] is not None):
        if adx_val[last] > 25 and adx_pos[last] > adx_neg[last]:
            buy_signals += 1
            details.append({"name": "ADX", "value": f"{adx_val[last]:.1f}", "signal": "BUY", "desc": "Tren kuat naik"})
        elif adx_val[last] > 25 and adx_neg[last] > adx_pos[last]:
            sell_signals += 1
            details.append({"name": "ADX", "value": f"{adx_val[last]:.1f}", "signal": "SELL", "desc": "Tren kuat turun"})
        else:
            details.append({"name": "ADX", "value": f"{adx_val[last]:.1f}" if adx_val[last] else "N/A", "signal": "NEUTRAL", "desc": "Tren lemah"})

    # CCI
    cci = indicators.get("cci", [None])
    if last < len(cci) and cci[last] is not None:
        if cci[last] < -100:
            buy_signals += 1
            details.append({"name": "CCI", "value": f"{cci[last]:.1f}", "signal": "BUY", "desc": "Oversold"})
        elif cci[last] > 100:
            sell_signals += 1
            details.append({"name": "CCI", "value": f"{cci[last]:.1f}", "signal": "SELL", "desc": "Overbought"})

    # Williams %R
    wr = indicators.get("williams_r", [None])
    if last < len(wr) and wr[last] is not None:
        if wr[last] < -80:
            buy_signals += 1
            details.append({"name": "Williams %R", "value": f"{wr[last]:.1f}", "signal": "BUY", "desc": "Oversold"})
        elif wr[last] > -20:
            sell_signals += 1
            details.append({"name": "Williams %R", "value": f"{wr[last]:.1f}", "signal": "SELL", "desc": "Overbought"})

    total = buy_signals + sell_signals
    score = ((buy_signals - sell_signals) / total * 100) if total > 0 else 0

    if score > 30:
        signal = "STRONG BUY"
    elif score > 10:
        signal = "BUY"
    elif score < -30:
        signal = "STRONG SELL"
    elif score < -10:
        signal = "SELL"
    else:
        signal = "NEUTRAL"

    return {"signal": signal, "score": round(score, 1), "buySignals": buy_signals,
            "sellSignals": sell_signals, "details": details}


# ── API Endpoints ────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "Python/FastAPI", "time": datetime.now().isoformat()}


@app.get("/api/chart/{symbol}")
def get_chart(symbol: str, range: str = "6mo", interval: str = "1d"):
    """Get OHLCV chart data"""
    df = fetch_stock_data(symbol, range)
    if df is None or df.empty:
        raise HTTPException(404, f"No data for {symbol}")

    data = []
    for idx, row in df.iterrows():
        ts = int(idx.timestamp())
        date_str = idx.strftime("%Y-%m-%d")
        if row["close"] and row["open"] and row["high"] and row["low"]:
            data.append({
                "time": ts, "date": date_str,
                "open": round(float(row["open"]), 2),
                "high": round(float(row["high"]), 2),
                "low": round(float(row["low"]), 2),
                "close": round(float(row["close"]), 2),
                "volume": int(row["volume"]) if not np.isnan(row["volume"]) else 0,
            })

    last_close = data[-1]["close"] if data else 0
    prev_close = data[-2]["close"] if len(data) > 1 else last_close

    return {
        "chart": {
            "result": [{
                "meta": {
                    "currency": "IDR",
                    "exchangeName": "JKT",
                    "regularMarketPrice": last_close,
                    "previousClose": prev_close,
                },
                "timestamp": [d["time"] for d in data],
                "indicators": {
                    "quote": [{
                        "open": [d["open"] for d in data],
                        "high": [d["high"] for d in data],
                        "low": [d["low"] for d in data],
                        "close": [d["close"] for d in data],
                        "volume": [d["volume"] for d in data],
                    }],
                    "adjclose": [{"adjclose": [d["close"] for d in data]}],
                }
            }]
        }
    }


@app.get("/api/quote")
def get_quote(symbols: str = Query(...)):
    """Get real-time quotes for multiple symbols"""
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    results = []

    for sym in symbol_list:
        try:
            ticker = yf.Ticker(sym)
            info = ticker.fast_info
            hist = ticker.history(period="2d")

            price = float(info.last_price) if hasattr(info, "last_price") else 0
            prev = float(info.previous_close) if hasattr(info, "previous_close") else price
            change = price - prev
            change_pct = (change / prev * 100) if prev else 0

            results.append({
                "symbol": sym,
                "shortName": STOCK_NAMES.get(sym.replace(".JK", ""), sym),
                "longName": STOCK_NAMES.get(sym.replace(".JK", ""), sym),
                "regularMarketPrice": round(price, 2),
                "regularMarketChange": round(change, 2),
                "regularMarketChangePercent": round(change_pct, 2),
                "regularMarketVolume": int(info.last_volume) if hasattr(info, "last_volume") else 0,
                "regularMarketDayHigh": float(hist["High"].iloc[-1]) if len(hist) > 0 else 0,
                "regularMarketDayLow": float(hist["Low"].iloc[-1]) if len(hist) > 0 else 0,
                "regularMarketOpen": float(info.open) if hasattr(info, "open") else 0,
                "regularMarketPreviousClose": round(prev, 2),
                "marketCap": int(info.market_cap) if hasattr(info, "market_cap") else 0,
                "fiftyTwoWeekHigh": float(info.year_high) if hasattr(info, "year_high") else 0,
                "fiftyTwoWeekLow": float(info.year_low) if hasattr(info, "year_low") else 0,
            })
        except Exception as e:
            print(f"Quote error [{sym}]: {e}")

    return {"quoteResponse": {"result": results}}


@app.get("/api/search")
def search_stocks(q: str = Query(...)):
    """Search for IDX stocks"""
    query = q.upper().strip()
    results = []

    # Search in known stocks
    for sector, symbols in SECTOR_MAP.items():
        for sym in symbols:
            name = STOCK_NAMES.get(sym, sym)
            if query in sym or query in name.upper() or query in sector.upper():
                results.append({
                    "symbol": f"{sym}.JK",
                    "name": name,
                    "sector": sector,
                    "exchange": "JKT",
                })
                if len(results) >= 15:
                    return {"quotes": results}

    return {"quotes": results}


@app.get("/api/idx-stocks")
def get_idx_stocks():
    """Get comprehensive IDX stock list"""
    stocks = []
    for sector, symbols in SECTOR_MAP.items():
        for sym in symbols:
            stocks.append({
                "symbol": f"{sym}.JK",
                "name": STOCK_NAMES.get(sym, sym),
                "sector": sector,
            })
    return {"stocks": stocks, "lastUpdated": datetime.now().isoformat()}


@app.get("/api/analyze/{symbol}")
def analyze_stock(symbol: str, period: str = "6mo"):
    """Full technical analysis using Python pandas + ta library"""
    df = fetch_stock_data(symbol, period)
    if df is None or df.empty or len(df) < 20:
        raise HTTPException(404, f"Insufficient data for {symbol}")

    indicators = compute_technical_indicators(df)
    tech_summary = generate_technical_summary(indicators, df)
    candle_patterns = detect_candle_patterns(df)

    # Volume analysis
    last = df.iloc[-1]
    avg_vol_20 = df["volume"].iloc[-20:].mean()
    vol_ratio = float(last["volume"] / avg_vol_20) if avg_vol_20 > 0 else 1

    vol5 = df["volume"].iloc[-5:].mean()
    vol10 = df["volume"].iloc[-10:].mean()
    vol_trend = "MENINGKAT" if vol5 > vol10 * 1.2 else ("MENURUN" if vol5 < vol10 * 0.8 else "STABIL")

    # ATR for range estimation
    atr_val = indicators.get("atr", [None])[-1] if indicators.get("atr") else None
    last_close = float(last["close"])

    # Entry point
    lows_20 = df["low"].iloc[-20:].tolist()
    highs_20 = df["high"].iloc[-20:].tolist()
    support = min(lows_20)
    resistance = max(highs_20)

    # Pivot points
    pp = (float(last["high"]) + float(last["low"]) + last_close) / 3
    r1 = 2 * pp - float(last["low"])
    s1 = 2 * pp - float(last["high"])
    r2 = pp + (float(last["high"]) - float(last["low"]))
    s2 = pp - (float(last["high"]) - float(last["low"]))

    # Prediction scoring
    bull_score = 0
    bear_score = 0
    factors = []

    for pat in candle_patterns:
        w = pat["strength"]
        if pat["type"] == "bullish": bull_score += w
        elif pat["type"] == "bearish": bear_score += w
        factors.append({"factor": f"Pola: {pat['name']}", "bias": pat["type"], "weight": w})

    # RSI
    rsi_val = indicators["rsi"][-1] if indicators.get("rsi") and indicators["rsi"][-1] is not None else None
    if rsi_val is not None:
        if rsi_val < 30:
            bull_score += 6; factors.append({"factor": f"RSI Oversold ({rsi_val:.1f})", "bias": "bullish", "weight": 6})
        elif rsi_val > 70:
            bear_score += 6; factors.append({"factor": f"RSI Overbought ({rsi_val:.1f})", "bias": "bearish", "weight": 6})
        elif rsi_val < 50:
            rsi_prev = indicators["rsi"][-2] if len(indicators["rsi"]) > 1 and indicators["rsi"][-2] is not None else rsi_val
            if rsi_val > rsi_prev:
                bull_score += 2; factors.append({"factor": "RSI Rising", "bias": "bullish", "weight": 2})
            else:
                bear_score += 2; factors.append({"factor": "RSI Falling", "bias": "bearish", "weight": 2})

    # MACD
    mh = indicators.get("macd_histogram", [])
    if len(mh) > 1 and mh[-1] is not None:
        if mh[-1] > 0 and (mh[-2] is None or mh[-2] <= 0):
            bull_score += 8; factors.append({"factor": "MACD Bullish Crossover", "bias": "bullish", "weight": 8})
        elif mh[-1] < 0 and (mh[-2] is None or mh[-2] >= 0):
            bear_score += 8; factors.append({"factor": "MACD Bearish Crossover", "bias": "bearish", "weight": 8})
        elif mh[-1] > (mh[-2] or 0):
            bull_score += 3; factors.append({"factor": "MACD Histogram Naik", "bias": "bullish", "weight": 3})
        else:
            bear_score += 3; factors.append({"factor": "MACD Histogram Turun", "bias": "bearish", "weight": 3})

    # BB
    bb_l = indicators.get("bb_lower", [])
    bb_u = indicators.get("bb_upper", [])
    if bb_l and bb_u and bb_l[-1] is not None:
        if last_close <= bb_l[-1]:
            bull_score += 5; factors.append({"factor": "Harga di Lower Bollinger", "bias": "bullish", "weight": 5})
        elif last_close >= bb_u[-1]:
            bear_score += 5; factors.append({"factor": "Harga di Upper Bollinger", "bias": "bearish", "weight": 5})

    # Volume
    if vol_ratio > 2 and last_close > float(df.iloc[-2]["close"]):
        bull_score += 5; factors.append({"factor": "Volume Tinggi + Harga Naik", "bias": "bullish", "weight": 5})
    elif vol_ratio > 2 and last_close < float(df.iloc[-2]["close"]):
        bear_score += 5; factors.append({"factor": "Volume Tinggi + Harga Turun", "bias": "bearish", "weight": 5})

    # SMA alignment
    s20 = indicators.get("sma20", [])
    s50 = indicators.get("sma50", [])
    if s20 and s50 and s20[-1] is not None and s50[-1] is not None:
        if last_close > s20[-1] and s20[-1] > s50[-1]:
            bull_score += 4; factors.append({"factor": "Price > SMA20 > SMA50", "bias": "bullish", "weight": 4})
        elif last_close < s20[-1] and s20[-1] < s50[-1]:
            bear_score += 4; factors.append({"factor": "Price < SMA20 < SMA50", "bias": "bearish", "weight": 4})

    total = bull_score + bear_score
    bull_pct = (bull_score / total * 100) if total > 0 else 50
    confidence = min(95, abs(bull_pct - 50) * 2 + 20)

    if bull_pct > 70: prediction = "NAIK KUAT"
    elif bull_pct > 55: prediction = "POTENSI NAIK"
    elif bull_pct < 30: prediction = "TURUN KUAT"
    elif bull_pct < 45: prediction = "POTENSI TURUN"
    else: prediction = "SIDEWAYS"

    bias = "strong-bullish" if bull_pct > 70 else "bullish" if bull_pct > 55 else \
           "strong-bearish" if bull_pct < 30 else "bearish" if bull_pct < 45 else "neutral"

    exp_high = last_close + (atr_val or 0) * (1.2 if bull_pct > 50 else 0.5)
    exp_low = last_close - (atr_val or 0) * (1.2 if bull_pct < 50 else 0.5)

    return {
        "symbol": symbol,
        "lastPrice": last_close,
        "date": df.index[-1].strftime("%Y-%m-%d"),
        "indicators": indicators,
        "techSummary": tech_summary,
        "candlePatterns": candle_patterns,
        "volumeProfile": {
            "todayVolume": int(last["volume"]),
            "avgVolume": round(avg_vol_20),
            "volumeRatio": round(vol_ratio, 2),
            "volumeTrend": vol_trend,
            "isUnusual": vol_ratio > 2,
        },
        "prediction": {
            "prediction": prediction,
            "bias": bias,
            "bullishScore": bull_score,
            "bearishScore": bear_score,
            "bullishPct": f"{bull_pct:.1f}",
            "confidence": f"{confidence:.0f}",
            "factors": factors,
            "expectedHigh": round(exp_high),
            "expectedLow": round(exp_low),
            "expectedRange": round(atr_val) if atr_val else 0,
            "lastClose": last_close,
        },
        "entryPoint": {
            "currentPrice": last_close,
            "support": round(support),
            "resistance": round(resistance),
            "pivotPoint": round(pp),
            "r1": round(r1), "r2": round(r2),
            "s1": round(s1), "s2": round(s2),
        },
    }


if __name__ == "__main__":
    import uvicorn
    print("\n🐍 IDX Screener Python Backend")
    print("   Powered by pandas + ta + yfinance\n")
    uvicorn.run(app, host="0.0.0.0", port=3001)
