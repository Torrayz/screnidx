// ============================================================
//  indicators.js — Technical Analysis Calculations
// ============================================================

/**
 * Simple Moving Average
 */
export function SMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += data[j];
            result.push(sum / period);
        }
    }
    return result;
}

/**
 * Exponential Moving Average
 */
export function EMA(data, period) {
    const result = [];
    const k = 2 / (period + 1);
    let prev = null;

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else if (i === period - 1) {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += data[j];
            prev = sum / period;
            result.push(prev);
        } else {
            prev = data[i] * k + prev * (1 - k);
            result.push(prev);
        }
    }
    return result;
}

/**
 * RSI — Relative Strength Index
 */
export function RSI(closes, period = 14) {
    const result = [];
    const gains = [];
    const losses = [];

    for (let i = 0; i < closes.length; i++) {
        if (i === 0) {
            gains.push(0);
            losses.push(0);
            result.push(null);
            continue;
        }
        const change = closes[i] - closes[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);

        if (i < period) {
            result.push(null);
        } else if (i === period) {
            let avgGain = 0, avgLoss = 0;
            for (let j = 1; j <= period; j++) {
                avgGain += gains[j];
                avgLoss += losses[j];
            }
            avgGain /= period;
            avgLoss /= period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            result.push(100 - 100 / (1 + rs));
            result._avgGain = avgGain;
            result._avgLoss = avgLoss;
        } else {
            const avgGain = (result._avgGain * (period - 1) + gains[i]) / period;
            const avgLoss = (result._avgLoss * (period - 1) + losses[i]) / period;
            result._avgGain = avgGain;
            result._avgLoss = avgLoss;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            result.push(100 - 100 / (1 + rs));
        }
    }
    return result;
}

/**
 * MACD — Moving Average Convergence Divergence
 */
export function MACD(closes, fast = 12, slow = 26, signal = 9) {
    const emaFast = EMA(closes, fast);
    const emaSlow = EMA(closes, slow);

    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
        if (emaFast[i] === null || emaSlow[i] === null) {
            macdLine.push(null);
        } else {
            macdLine.push(emaFast[i] - emaSlow[i]);
        }
    }

    // Filter non-null for signal line
    const macdValues = macdLine.filter(v => v !== null);
    const signalLine = EMA(macdValues, signal);

    // Map back
    const fullSignal = [];
    const histogram = [];
    let idx = 0;
    for (let i = 0; i < closes.length; i++) {
        if (macdLine[i] === null) {
            fullSignal.push(null);
            histogram.push(null);
        } else {
            fullSignal.push(signalLine[idx] ?? null);
            histogram.push(
                signalLine[idx] !== null ? macdLine[i] - signalLine[idx] : null
            );
            idx++;
        }
    }

    return { macd: macdLine, signal: fullSignal, histogram };
}

/**
 * Bollinger Bands
 */
export function BollingerBands(closes, period = 20, stdDev = 2) {
    const sma = SMA(closes, period);
    const upper = [];
    const lower = [];

    for (let i = 0; i < closes.length; i++) {
        if (sma[i] === null) {
            upper.push(null);
            lower.push(null);
        } else {
            let sumSq = 0;
            for (let j = i - period + 1; j <= i; j++) {
                sumSq += (closes[j] - sma[i]) ** 2;
            }
            const std = Math.sqrt(sumSq / period);
            upper.push(sma[i] + stdDev * std);
            lower.push(sma[i] - stdDev * std);
        }
    }

    return { middle: sma, upper, lower };
}

/**
 * Stochastic Oscillator
 */
export function Stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    const kValues = [];

    for (let i = 0; i < closes.length; i++) {
        if (i < kPeriod - 1) {
            kValues.push(null);
        } else {
            let highestHigh = -Infinity;
            let lowestLow = Infinity;
            for (let j = i - kPeriod + 1; j <= i; j++) {
                if (highs[j] > highestHigh) highestHigh = highs[j];
                if (lows[j] < lowestLow) lowestLow = lows[j];
            }
            const range = highestHigh - lowestLow;
            kValues.push(range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100);
        }
    }

    const dValues = SMA(kValues.map(v => v ?? 0), dPeriod);
    // Fix nulls
    for (let i = 0; i < kPeriod - 1 + dPeriod - 1; i++) {
        if (i < dValues.length) dValues[i] = null;
    }

    return { k: kValues, d: dValues };
}

/**
 * ADX — Average Directional Index
 */
export function ADX(highs, lows, closes, period = 14) {
    const plusDM = [];
    const minusDM = [];
    const tr = [];

    for (let i = 0; i < closes.length; i++) {
        if (i === 0) {
            plusDM.push(0);
            minusDM.push(0);
            tr.push(highs[i] - lows[i]);
            continue;
        }
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        tr.push(Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        ));
    }

    const smoothTR = EMA(tr, period);
    const smoothPlusDM = EMA(plusDM, period);
    const smoothMinusDM = EMA(minusDM, period);

    const plusDI = [];
    const minusDI = [];
    const dx = [];

    for (let i = 0; i < closes.length; i++) {
        if (smoothTR[i] === null || smoothTR[i] === 0) {
            plusDI.push(null);
            minusDI.push(null);
            dx.push(null);
        } else {
            const pdi = ((smoothPlusDM[i] || 0) / smoothTR[i]) * 100;
            const mdi = ((smoothMinusDM[i] || 0) / smoothTR[i]) * 100;
            plusDI.push(pdi);
            minusDI.push(mdi);
            const denom = pdi + mdi;
            dx.push(denom === 0 ? 0 : (Math.abs(pdi - mdi) / denom) * 100);
        }
    }

    const adxValues = EMA(dx.map(v => v ?? 0), period);
    for (let i = 0; i < period * 2 - 1 && i < adxValues.length; i++) {
        adxValues[i] = null;
    }

    return { adx: adxValues, plusDI, minusDI };
}

/**
 * MFI — Money Flow Index
 */
export function MFI(highs, lows, closes, volumes, period = 14) {
    const typicalPrices = [];
    const mf = [];

    for (let i = 0; i < closes.length; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        typicalPrices.push(tp);
        mf.push(tp * volumes[i]);
    }

    const result = [];
    for (let i = 0; i < closes.length; i++) {
        if (i < period) {
            result.push(null);
            continue;
        }
        let posMF = 0, negMF = 0;
        for (let j = i - period + 1; j <= i; j++) {
            if (typicalPrices[j] > typicalPrices[j - 1]) {
                posMF += mf[j];
            } else {
                negMF += mf[j];
            }
        }
        const ratio = negMF === 0 ? 100 : posMF / negMF;
        result.push(100 - 100 / (1 + ratio));
    }
    return result;
}

/**
 * OBV — On-Balance Volume
 */
export function OBV(closes, volumes) {
    const result = [0];
    for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) {
            result.push(result[i - 1] + volumes[i]);
        } else if (closes[i] < closes[i - 1]) {
            result.push(result[i - 1] - volumes[i]);
        } else {
            result.push(result[i - 1]);
        }
    }
    return result;
}

/**
 * VWAP — Volume Weighted Average Price
 */
export function VWAP(highs, lows, closes, volumes) {
    const result = [];
    let cumVol = 0;
    let cumTP = 0;

    for (let i = 0; i < closes.length; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        cumTP += tp * volumes[i];
        cumVol += volumes[i];
        result.push(cumVol === 0 ? tp : cumTP / cumVol);
    }
    return result;
}

/**
 * Support & Resistance levels using pivot points
 */
export function PivotPoints(high, low, close) {
    const pp = (high + low + close) / 3;
    const r1 = 2 * pp - low;
    const s1 = 2 * pp - high;
    const r2 = pp + (high - low);
    const s2 = pp - (high - low);
    const r3 = high + 2 * (pp - low);
    const s3 = low - 2 * (high - pp);
    return { pp, r1, r2, r3, s1, s2, s3 };
}

/**
 * Calculate all indicators at once
 */
export function calculateAllIndicators(chartData) {
    const closes = chartData.map(d => d.close);
    const highs = chartData.map(d => d.high);
    const lows = chartData.map(d => d.low);
    const volumes = chartData.map(d => d.volume);

    const sma5 = SMA(closes, 5);
    const sma10 = SMA(closes, 10);
    const sma20 = SMA(closes, 20);
    const sma50 = SMA(closes, 50);
    const sma200 = SMA(closes, 200);
    const ema12 = EMA(closes, 12);
    const ema26 = EMA(closes, 26);
    const rsi = RSI(closes, 14);
    const macd = MACD(closes);
    const bb = BollingerBands(closes, 20, 2);
    const stoch = Stochastic(highs, lows, closes);
    const adx = ADX(highs, lows, closes);
    const mfi = MFI(highs, lows, closes, volumes);
    const obv = OBV(closes, volumes);
    const vwap = VWAP(highs, lows, closes, volumes);

    // Calculate support/resistance from last data
    const lastIdx = chartData.length - 1;
    const pivots = lastIdx >= 0
        ? PivotPoints(highs[lastIdx], lows[lastIdx], closes[lastIdx])
        : null;

    return {
        sma: { sma5, sma10, sma20, sma50, sma200 },
        ema: { ema12, ema26 },
        rsi,
        macd,
        bb,
        stoch,
        adx,
        mfi,
        obv,
        vwap,
        pivots,
    };
}

/**
 * Generate technical analysis summary signal
 */
export function getTechnicalSummary(indicators, chartData) {
    const len = chartData.length;
    const last = len - 1;
    if (last < 0) return { signal: 'NEUTRAL', score: 0, details: [] };

    const details = [];
    let buySignals = 0;
    let sellSignals = 0;

    // RSI
    const rsiVal = indicators.rsi[last];
    if (rsiVal !== null) {
        if (rsiVal < 30) { buySignals += 2; details.push({ name: 'RSI', value: rsiVal.toFixed(1), signal: 'BUY', desc: 'Oversold' }); }
        else if (rsiVal < 40) { buySignals += 1; details.push({ name: 'RSI', value: rsiVal.toFixed(1), signal: 'BUY', desc: 'Mendekati oversold' }); }
        else if (rsiVal > 70) { sellSignals += 2; details.push({ name: 'RSI', value: rsiVal.toFixed(1), signal: 'SELL', desc: 'Overbought' }); }
        else if (rsiVal > 60) { sellSignals += 1; details.push({ name: 'RSI', value: rsiVal.toFixed(1), signal: 'SELL', desc: 'Mendekati overbought' }); }
        else { details.push({ name: 'RSI', value: rsiVal.toFixed(1), signal: 'NEUTRAL', desc: 'Netral' }); }
    }

    // MACD
    const macdVal = indicators.macd.macd[last];
    const signalVal = indicators.macd.signal[last];
    const histVal = indicators.macd.histogram[last];
    if (macdVal !== null && signalVal !== null) {
        if (histVal > 0 && indicators.macd.histogram[last - 1] <= 0) {
            buySignals += 2; details.push({ name: 'MACD', value: macdVal.toFixed(2), signal: 'BUY', desc: 'Bullish crossover' });
        } else if (histVal < 0 && indicators.macd.histogram[last - 1] >= 0) {
            sellSignals += 2; details.push({ name: 'MACD', value: macdVal.toFixed(2), signal: 'SELL', desc: 'Bearish crossover' });
        } else if (histVal > 0) {
            buySignals += 1; details.push({ name: 'MACD', value: macdVal.toFixed(2), signal: 'BUY', desc: 'Bullish' });
        } else {
            sellSignals += 1; details.push({ name: 'MACD', value: macdVal.toFixed(2), signal: 'SELL', desc: 'Bearish' });
        }
    }

    // Moving Average Cross
    const sma20 = indicators.sma.sma20[last];
    const sma50 = indicators.sma.sma50[last];
    const close = chartData[last].close;
    if (sma20 !== null && sma50 !== null) {
        if (sma20 > sma50 && indicators.sma.sma20[last - 1] <= indicators.sma.sma50[last - 1]) {
            buySignals += 3; details.push({ name: 'Golden Cross', value: `SMA20: ${sma20.toFixed(0)}`, signal: 'BUY', desc: 'SMA20 > SMA50' });
        } else if (sma20 < sma50 && indicators.sma.sma20[last - 1] >= indicators.sma.sma50[last - 1]) {
            sellSignals += 3; details.push({ name: 'Death Cross', value: `SMA20: ${sma20.toFixed(0)}`, signal: 'SELL', desc: 'SMA20 < SMA50' });
        }
        if (close > sma20) {
            buySignals += 1; details.push({ name: 'Price vs SMA20', value: close.toFixed(0), signal: 'BUY', desc: 'Di atas SMA20' });
        } else {
            sellSignals += 1; details.push({ name: 'Price vs SMA20', value: close.toFixed(0), signal: 'SELL', desc: 'Di bawah SMA20' });
        }
    }

    // Bollinger Bands
    const bbUpper = indicators.bb.upper[last];
    const bbLower = indicators.bb.lower[last];
    if (bbUpper !== null && bbLower !== null) {
        if (close <= bbLower) {
            buySignals += 2; details.push({ name: 'Bollinger', value: close.toFixed(0), signal: 'BUY', desc: 'Menyentuh lower band' });
        } else if (close >= bbUpper) {
            sellSignals += 2; details.push({ name: 'Bollinger', value: close.toFixed(0), signal: 'SELL', desc: 'Menyentuh upper band' });
        } else {
            details.push({ name: 'Bollinger', value: close.toFixed(0), signal: 'NEUTRAL', desc: 'Dalam band' });
        }
    }

    // Stochastic
    const stochK = indicators.stoch.k[last];
    const stochD = indicators.stoch.d[last];
    if (stochK !== null) {
        if (stochK < 20 && stochD < 20) {
            buySignals += 2; details.push({ name: 'Stochastic', value: stochK.toFixed(1), signal: 'BUY', desc: 'Oversold' });
        } else if (stochK > 80 && stochD > 80) {
            sellSignals += 2; details.push({ name: 'Stochastic', value: stochK.toFixed(1), signal: 'SELL', desc: 'Overbought' });
        } else {
            details.push({ name: 'Stochastic', value: stochK.toFixed(1), signal: 'NEUTRAL', desc: 'Netral' });
        }
    }

    // MFI
    const mfiVal = indicators.mfi[last];
    if (mfiVal !== null) {
        if (mfiVal < 20) {
            buySignals += 1; details.push({ name: 'MFI', value: mfiVal.toFixed(1), signal: 'BUY', desc: 'Oversold' });
        } else if (mfiVal > 80) {
            sellSignals += 1; details.push({ name: 'MFI', value: mfiVal.toFixed(1), signal: 'SELL', desc: 'Overbought' });
        } else {
            details.push({ name: 'MFI', value: mfiVal.toFixed(1), signal: 'NEUTRAL', desc: 'Netral' });
        }
    }

    // ADX
    const adxVal = indicators.adx.adx[last];
    if (adxVal !== null) {
        const plusDI = indicators.adx.plusDI[last];
        const minusDI = indicators.adx.minusDI[last];
        if (adxVal > 25 && plusDI > minusDI) {
            buySignals += 1; details.push({ name: 'ADX', value: adxVal.toFixed(1), signal: 'BUY', desc: 'Tren kuat naik' });
        } else if (adxVal > 25 && minusDI > plusDI) {
            sellSignals += 1; details.push({ name: 'ADX', value: adxVal.toFixed(1), signal: 'SELL', desc: 'Tren kuat turun' });
        } else {
            details.push({ name: 'ADX', value: adxVal?.toFixed(1) ?? 'N/A', signal: 'NEUTRAL', desc: 'Tren lemah' });
        }
    }

    const total = buySignals + sellSignals;
    const score = total === 0 ? 0 : ((buySignals - sellSignals) / total) * 100;

    let signal;
    if (score > 30) signal = 'STRONG BUY';
    else if (score > 10) signal = 'BUY';
    else if (score < -30) signal = 'STRONG SELL';
    else if (score < -10) signal = 'SELL';
    else signal = 'NEUTRAL';

    return { signal, score, buySignals, sellSignals, details };
}
