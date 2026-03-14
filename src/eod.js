// ============================================================
//  eod.js — End-of-Day Deep Analysis Engine
//  Analisa mendalam setelah market tutup untuk prediksi besok
// ============================================================

import { calculateAllIndicators, getTechnicalSummary, SMA, EMA, RSI } from './indicators.js';
import { getBandarmologySummary } from './bandarmology.js';

/**
 * Detect candlestick patterns from last 3 candles
 */
function detectCandlePatterns(data) {
    if (data.length < 3) return [];
    const patterns = [];
    const n = data.length;
    const c = data[n - 1]; // current candle
    const p = data[n - 2]; // previous candle
    const pp = data[n - 3]; // 2 candles ago

    const bodyC = Math.abs(c.close - c.open);
    const bodyP = Math.abs(p.close - p.open);
    const rangeC = c.high - c.low;
    const rangeP = p.high - p.low;
    const upperWickC = c.high - Math.max(c.open, c.close);
    const lowerWickC = Math.min(c.open, c.close) - c.low;
    const isBullC = c.close > c.open;
    const isBearC = c.close < c.open;
    const isBullP = p.close > p.open;
    const isBearP = p.close < p.open;

    // Hammer (bullish reversal)
    if (lowerWickC > bodyC * 2 && upperWickC < bodyC * 0.3 && rangeC > 0) {
        patterns.push({ name: 'Hammer', type: 'bullish', strength: 7, desc: 'Potensi reversal naik — buyer dominan di akhir sesi' });
    }

    // Inverted Hammer
    if (upperWickC > bodyC * 2 && lowerWickC < bodyC * 0.3 && rangeC > 0) {
        patterns.push({ name: 'Inverted Hammer', type: 'bullish', strength: 5, desc: 'Potensi reversal naik — harus dikonfirmasi besok' });
    }

    // Shooting Star (bearish reversal)
    if (upperWickC > bodyC * 2 && lowerWickC < bodyC * 0.3 && isBearC) {
        patterns.push({ name: 'Shooting Star', type: 'bearish', strength: 7, desc: 'Potensi reversal turun — seller kuat di puncak' });
    }

    // Doji
    if (bodyC < rangeC * 0.1 && rangeC > 0) {
        patterns.push({ name: 'Doji', type: 'neutral', strength: 6, desc: 'Market ragu-ragu — tunggu konfirmasi arah besok' });
    }

    // Bullish Engulfing
    if (isBullC && isBearP && c.open <= p.close && c.close >= p.open && bodyC > bodyP) {
        patterns.push({ name: 'Bullish Engulfing', type: 'bullish', strength: 8, desc: 'Sinyal kuat — buyer mengambil alih, potensi naik besok' });
    }

    // Bearish Engulfing
    if (isBearC && isBullP && c.open >= p.close && c.close <= p.open && bodyC > bodyP) {
        patterns.push({ name: 'Bearish Engulfing', type: 'bearish', strength: 8, desc: 'Sinyal kuat — seller mengambil alih, potensi turun besok' });
    }

    // Morning Star (3-candle bullish reversal)
    const bodyPP = Math.abs(pp.close - pp.open);
    if (pp.close < pp.open && bodyPP > rangeP * 0.3 &&
        bodyP < bodyPP * 0.3 &&
        isBullC && c.close > (pp.open + pp.close) / 2) {
        patterns.push({ name: 'Morning Star', type: 'bullish', strength: 9, desc: 'Pola 3 candle reversal — sinyal paling kuat untuk naik' });
    }

    // Evening Star (3-candle bearish reversal)
    if (pp.close > pp.open && bodyPP > rangeP * 0.3 &&
        bodyP < bodyPP * 0.3 &&
        isBearC && c.close < (pp.open + pp.close) / 2) {
        patterns.push({ name: 'Evening Star', type: 'bearish', strength: 9, desc: 'Pola 3 candle reversal — sinyal paling kuat untuk turun' });
    }

    // Three White Soldiers
    if (isBullC && isBullP && pp.close > pp.open &&
        c.close > p.close && p.close > pp.close &&
        bodyC > rangeC * 0.5 && bodyP > rangeP * 0.5) {
        patterns.push({ name: 'Three White Soldiers', type: 'bullish', strength: 9, desc: '3 candle naik berturut — tren naik kuat, lanjut besok' });
    }

    // Three Black Crows
    if (isBearC && isBearP && pp.close < pp.open &&
        c.close < p.close && p.close < pp.close &&
        bodyC > rangeC * 0.5 && bodyP > rangeP * 0.5) {
        patterns.push({ name: 'Three Black Crows', type: 'bearish', strength: 9, desc: '3 candle turun berturut — tekanan jual kuat, hati-hati besok' });
    }

    return patterns;
}

/**
 * Analyze volume profile for EOD
 */
function analyzeVolumeProfile(data) {
    if (data.length < 20) return null;
    const recent = data.slice(-20);
    const avgVol = recent.reduce((s, d) => s + d.volume, 0) / 20;
    const todayVol = data[data.length - 1].volume;
    const ratio = todayVol / avgVol;

    // Price-volume correlation
    const last5 = data.slice(-5);
    let priceUp = 0, volUp = 0;
    for (let i = 1; i < last5.length; i++) {
        if (last5[i].close > last5[i - 1].close) priceUp++;
        if (last5[i].volume > last5[i - 1].volume) volUp++;
    }

    // Volume trend
    const vol5 = data.slice(-5).reduce((s, d) => s + d.volume, 0) / 5;
    const vol10 = data.slice(-10).reduce((s, d) => s + d.volume, 0) / 10;
    const volTrend = vol5 > vol10 * 1.2 ? 'MENINGKAT' : vol5 < vol10 * 0.8 ? 'MENURUN' : 'STABIL';

    return {
        todayVolume: todayVol,
        avgVolume: avgVol,
        volumeRatio: ratio,
        isUnusual: ratio > 2,
        isAboveAvg: ratio > 1.3,
        isBelowAvg: ratio < 0.7,
        volumeTrend: volTrend,
        priceVolumeCorrelation: priceUp === volUp ? 'SELARAS' : 'DIVERGENSI',
    };
}

/**
 * Generate next-day prediction based on multiple factors
 */
function generatePrediction(data, indicators, bandar, patterns, volumeProfile) {
    const last = data.length - 1;
    const c = data[last];
    const p = data[last - 1];

    let bullishScore = 0;
    let bearishScore = 0;
    const factors = [];

    // 1. Candlestick Pattern Score
    for (const pat of patterns) {
        if (pat.type === 'bullish') bullishScore += pat.strength;
        else if (pat.type === 'bearish') bearishScore += pat.strength;
        factors.push({ factor: `Pola: ${pat.name}`, bias: pat.type, weight: pat.strength });
    }

    // 2. RSI Momentum
    const rsi = indicators.rsi[last];
    const rsiPrev = indicators.rsi[last - 1];
    if (rsi !== null) {
        if (rsi < 30) {
            bullishScore += 6;
            factors.push({ factor: `RSI Oversold (${rsi.toFixed(1)})`, bias: 'bullish', weight: 6 });
        } else if (rsi > 70) {
            bearishScore += 6;
            factors.push({ factor: `RSI Overbought (${rsi.toFixed(1)})`, bias: 'bearish', weight: 6 });
        } else if (rsiPrev && rsi > rsiPrev) {
            bullishScore += 2;
            factors.push({ factor: 'RSI Rising', bias: 'bullish', weight: 2 });
        } else if (rsiPrev && rsi < rsiPrev) {
            bearishScore += 2;
            factors.push({ factor: 'RSI Falling', bias: 'bearish', weight: 2 });
        }
    }

    // 3. MACD Direction
    const macdHist = indicators.macd.histogram[last];
    const macdHistPrev = indicators.macd.histogram[last - 1];
    if (macdHist !== null && macdHistPrev !== null) {
        if (macdHist > 0 && macdHistPrev <= 0) {
            bullishScore += 8;
            factors.push({ factor: 'MACD Bullish Crossover', bias: 'bullish', weight: 8 });
        } else if (macdHist < 0 && macdHistPrev >= 0) {
            bearishScore += 8;
            factors.push({ factor: 'MACD Bearish Crossover', bias: 'bearish', weight: 8 });
        } else if (macdHist > macdHistPrev) {
            bullishScore += 3;
            factors.push({ factor: 'MACD Histogram Naik', bias: 'bullish', weight: 3 });
        } else {
            bearishScore += 3;
            factors.push({ factor: 'MACD Histogram Turun', bias: 'bearish', weight: 3 });
        }
    }

    // 4. Bollinger Bands Position
    const bbLower = indicators.bb.lower[last];
    const bbUpper = indicators.bb.upper[last];
    if (bbLower !== null && bbUpper !== null) {
        if (c.close <= bbLower) {
            bullishScore += 5;
            factors.push({ factor: 'Harga di Lower Bollinger', bias: 'bullish', weight: 5 });
        } else if (c.close >= bbUpper) {
            bearishScore += 5;
            factors.push({ factor: 'Harga di Upper Bollinger', bias: 'bearish', weight: 5 });
        }
    }

    // 5. Volume Confirmation
    if (volumeProfile) {
        if (volumeProfile.isUnusual && c.close > p.close) {
            bullishScore += 5;
            factors.push({ factor: 'Volume Tinggi + Harga Naik', bias: 'bullish', weight: 5 });
        } else if (volumeProfile.isUnusual && c.close < p.close) {
            bearishScore += 5;
            factors.push({ factor: 'Volume Tinggi + Harga Turun', bias: 'bearish', weight: 5 });
        }
        if (volumeProfile.priceVolumeCorrelation === 'DIVERGENSI') {
            factors.push({ factor: 'Divergensi Price-Volume', bias: 'warning', weight: 3 });
        }
    }

    // 6. Bandar/Smart Money
    if (bandar) {
        if (bandar.overallPhase?.includes('ACCUMULATION')) {
            bullishScore += 5;
            factors.push({ factor: 'Fase Akumulasi Bandar', bias: 'bullish', weight: 5 });
        } else if (bandar.overallPhase?.includes('DISTRIBUTION')) {
            bearishScore += 5;
            factors.push({ factor: 'Fase Distribusi Bandar', bias: 'bearish', weight: 5 });
        }
    }

    // 7. SMA Position
    const sma20 = indicators.sma.sma20[last];
    const sma50 = indicators.sma.sma50[last];
    if (sma20 && sma50) {
        if (c.close > sma20 && sma20 > sma50) {
            bullishScore += 4;
            factors.push({ factor: 'Price > SMA20 > SMA50', bias: 'bullish', weight: 4 });
        } else if (c.close < sma20 && sma20 < sma50) {
            bearishScore += 4;
            factors.push({ factor: 'Price < SMA20 < SMA50', bias: 'bearish', weight: 4 });
        }
    }

    // 8. Stochastic
    const stochK = indicators.stoch.k[last];
    const stochD = indicators.stoch.d[last];
    if (stochK !== null && stochD !== null) {
        if (stochK < 20 && stochK > stochD) {
            bullishScore += 4;
            factors.push({ factor: 'Stochastic Bullish di Oversold', bias: 'bullish', weight: 4 });
        } else if (stochK > 80 && stochK < stochD) {
            bearishScore += 4;
            factors.push({ factor: 'Stochastic Bearish di Overbought', bias: 'bearish', weight: 4 });
        }
    }

    // Calculate total & prediction
    const total = bullishScore + bearishScore;
    const bullishPct = total > 0 ? (bullishScore / total) * 100 : 50;
    const confidence = Math.min(95, Math.abs(bullishPct - 50) * 2 + 20);

    let prediction, bias;
    if (bullishPct > 70) { prediction = 'NAIK KUAT'; bias = 'strong-bullish'; }
    else if (bullishPct > 55) { prediction = 'POTENSI NAIK'; bias = 'bullish'; }
    else if (bullishPct < 30) { prediction = 'TURUN KUAT'; bias = 'strong-bearish'; }
    else if (bullishPct < 45) { prediction = 'POTENSI TURUN'; bias = 'bearish'; }
    else { prediction = 'SIDEWAYS'; bias = 'neutral'; }

    // Estimated range for tomorrow
    const atr = calculateATR(data, 14);
    const expectedHigh = c.close + atr * (bullishPct > 50 ? 1.2 : 0.5);
    const expectedLow = c.close - atr * (bullishPct < 50 ? 1.2 : 0.5);

    return {
        prediction,
        bias,
        bullishScore,
        bearishScore,
        bullishPct: bullishPct.toFixed(1),
        confidence: confidence.toFixed(0),
        factors,
        expectedHigh: Math.round(expectedHigh),
        expectedLow: Math.round(expectedLow),
        expectedRange: Math.round(atr),
        lastClose: c.close,
    };
}

/**
 * Calculate Average True Range
 */
function calculateATR(data, period = 14) {
    if (data.length < period + 1) return 0;
    let atrSum = 0;
    for (let i = data.length - period; i < data.length; i++) {
        const tr = Math.max(
            data[i].high - data[i].low,
            Math.abs(data[i].high - data[i - 1].close),
            Math.abs(data[i].low - data[i - 1].close)
        );
        atrSum += tr;
    }
    return atrSum / period;
}

/**
 * Full EOD analysis for a single stock
 */
export function analyzeEOD(chartResult) {
    if (!chartResult || !chartResult.data || chartResult.data.length < 30) return null;

    const data = chartResult.data;
    const indicators = calculateAllIndicators(data);
    const techSummary = getTechnicalSummary(indicators, data);
    const bandar = getBandarmologySummary(data);
    const candlePatterns = detectCandlePatterns(data);
    const volumeProfile = analyzeVolumeProfile(data);
    const prediction = generatePrediction(data, indicators, bandar, candlePatterns, volumeProfile);

    const last = data[data.length - 1];
    const prev = data[data.length - 2];

    // Trend analysis (SMA alignment)
    const sma20 = indicators.sma.sma20[data.length - 1];
    const sma50 = indicators.sma.sma50[data.length - 1];
    let trend = 'SIDEWAYS';
    if (sma20 && sma50) {
        if (last.close > sma20 && sma20 > sma50) trend = 'UPTREND';
        else if (last.close < sma20 && sma20 < sma50) trend = 'DOWNTREND';
    }

    return {
        symbol: chartResult.symbol,
        lastPrice: last.close,
        change: prev ? ((last.close - prev.close) / prev.close) * 100 : 0,
        volume: last.volume,
        date: last.date,
        trend,
        techSummary,
        candlePatterns,
        volumeProfile,
        prediction,
        bandar,
        indicators,
    };
}

/**
 * Calculate market breadth from multiple EOD analyses
 */
export function calculateMarketBreadth(eodResults) {
    if (!eodResults.length) return null;

    let advancers = 0, decliners = 0, unchanged = 0;
    let buySignals = 0, sellSignals = 0, neutralSignals = 0;
    let totalVolume = 0, avgVolume = 0;
    let bullishPredictions = 0, bearishPredictions = 0;

    const sectorPerformance = {};

    for (const stock of eodResults) {
        if (!stock) continue;

        // A/D/U
        if (stock.change > 0.1) advancers++;
        else if (stock.change < -0.1) decliners++;
        else unchanged++;

        // Signals
        const sig = stock.techSummary.signal;
        if (sig.includes('BUY')) buySignals++;
        else if (sig.includes('SELL')) sellSignals++;
        else neutralSignals++;

        // Volume
        totalVolume += stock.volume;
        if (stock.volumeProfile) avgVolume += stock.volumeProfile.volumeRatio;

        // Predictions
        if (stock.prediction.bias.includes('bullish')) bullishPredictions++;
        else if (stock.prediction.bias.includes('bearish')) bearishPredictions++;

        // Sector tracking
        // (symbol lookup needed for sector)
    }

    const total = eodResults.filter(Boolean).length;
    const adRatio = decliners > 0 ? (advancers / decliners).toFixed(2) : advancers.toString();
    const marketSentiment = advancers > decliners * 1.5 ? 'BULLISH'
        : decliners > advancers * 1.5 ? 'BEARISH' : 'NETRAL';

    return {
        total,
        advancers,
        decliners,
        unchanged,
        adRatio,
        marketSentiment,
        buySignals,
        sellSignals,
        neutralSignals,
        totalVolume,
        avgVolumeRatio: total > 0 ? (avgVolume / total).toFixed(2) : '1.00',
        bullishPredictions,
        bearishPredictions,
        neutralPredictions: total - bullishPredictions - bearishPredictions,
        tomorrowBias: bullishPredictions > bearishPredictions * 1.3 ? 'BULLISH'
            : bearishPredictions > bullishPredictions * 1.3 ? 'BEARISH' : 'MIXED',
    };
}
