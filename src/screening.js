// ============================================================
//  screening.js — Stock Screener & Entry Point Calculator
// ============================================================
import { calculateAllIndicators, getTechnicalSummary } from './indicators.js';
import { getBandarmologySummary } from './bandarmology.js';

/**
 * Screen a single stock and return analysis
 */
export function screenStock(chartResult) {
    if (!chartResult || !chartResult.data || chartResult.data.length < 30) return null;

    const data = chartResult.data;
    const indicators = calculateAllIndicators(data);
    const techSummary = getTechnicalSummary(indicators, data);
    const bandar = getBandarmologySummary(data);
    const last = data[data.length - 1];
    const prev = data[data.length - 2];

    // Entry point calculation
    const entryPoint = calculateEntryPoint(data, indicators, bandar);

    return {
        symbol: chartResult.symbol,
        lastPrice: last.close,
        change: prev ? ((last.close - prev.close) / prev.close) * 100 : 0,
        volume: last.volume,
        indicators,
        techSummary,
        bandar,
        entryPoint,
        data,
    };
}

/**
 * Calculate entry point with support/resistance and risk/reward
 */
function calculateEntryPoint(data, indicators, bandar) {
    const last = data[data.length - 1];
    const closes = data.map(d => d.close);
    const lows = data.map(d => d.low);
    const highs = data.map(d => d.high);

    // Find recent support (lowest low in last 20 candles)
    const recentLows = lows.slice(-20);
    const support = Math.min(...recentLows);

    // Find recent resistance (highest high in last 20 candles)
    const recentHighs = highs.slice(-20);
    const resistance = Math.max(...recentHighs);

    // Support level 2 (lowest in last 50 candles)
    const support2 = Math.min(...lows.slice(-Math.min(50, lows.length)));

    // Resistance level 2 (highest in last 50 candles)
    const resistance2 = Math.max(...highs.slice(-Math.min(50, highs.length)));

    // Pivot points
    const pivots = indicators.pivots;

    // Entry price suggestion
    const sma20 = indicators.sma.sma20[closes.length - 1];
    const bbLower = indicators.bb.lower[closes.length - 1];

    let entryPrice = last.close;
    let entryReason = '';

    // Best entry near support + oversold indicators
    const rsi = indicators.rsi[closes.length - 1];
    const stochK = indicators.stoch.k[closes.length - 1];

    if (rsi < 30 || stochK < 20) {
        entryPrice = Math.max(support, bbLower || support);
        entryReason = 'Entry saat oversold di dekat support level';
    } else if (last.close <= support * 1.02) {
        entryPrice = support;
        entryReason = 'Entry di support level dengan konfirmasi volume';
    } else if (sma20 && last.close <= sma20 * 1.01) {
        entryPrice = sma20;
        entryReason = 'Entry di SMA20 sebagai dynamic support';
    } else if (bandar && bandar.overallPhase.includes('ACCUMULATION')) {
        entryPrice = last.close * 0.99;
        entryReason = 'Entry saat fase akumulasi bandar, tunggu pullback kecil';
    } else {
        entryPrice = last.close;
        entryReason = 'Harga di area netral, perhatikan level support terdekat';
    }

    // Stop loss (below support)
    const stopLoss = support * 0.97;
    const stopLossPercent = ((entryPrice - stopLoss) / entryPrice) * 100;

    // Target 1 (nearest resistance)
    const target1 = resistance;
    const target1Percent = ((target1 - entryPrice) / entryPrice) * 100;

    // Target 2 (next resistance)
    const target2 = resistance2;
    const target2Percent = ((target2 - entryPrice) / entryPrice) * 100;

    // Risk/Reward ratio
    const risk = entryPrice - stopLoss;
    const reward = target1 - entryPrice;
    const riskReward = risk > 0 ? (reward / risk).toFixed(2) : 'N/A';

    // Entry recommendation
    let recommendation = 'WAIT';
    if (rsi < 35 && bandar?.overallPhase?.includes('ACCUMULATION')) {
        recommendation = 'STRONG ENTRY';
    } else if (rsi < 40 || stochK < 25) {
        recommendation = 'ENTRY';
    } else if (bandar?.bandarMeter > 65) {
        recommendation = 'ENTRY (BANDAR)';
    } else if (rsi > 70) {
        recommendation = 'AVOID (OVERBOUGHT)';
    }

    return {
        currentPrice: last.close,
        entryPrice: Math.round(entryPrice),
        entryReason,
        stopLoss: Math.round(stopLoss),
        stopLossPercent: stopLossPercent.toFixed(2),
        target1: Math.round(target1),
        target1Percent: target1Percent.toFixed(2),
        target2: Math.round(target2),
        target2Percent: target2Percent.toFixed(2),
        riskReward,
        support: Math.round(support),
        support2: Math.round(support2),
        resistance: Math.round(resistance),
        resistance2: Math.round(resistance2),
        recommendation,
        pivots,
    };
}

/**
 * Filter stocks based on screening criteria
 */
export function filterStocks(screenedStocks, filters) {
    return screenedStocks.filter(stock => {
        if (!stock) return false;

        // Signal filter
        if (filters.signal) {
            const sig = stock.techSummary.signal;
            if (filters.signal === 'BUY' && !sig.includes('BUY')) return false;
            if (filters.signal === 'SELL' && !sig.includes('SELL')) return false;
            if (filters.signal === 'NEUTRAL' && sig !== 'NEUTRAL') return false;
        }

        // RSI filter
        if (filters.rsiBelow) {
            const rsi = stock.indicators.rsi[stock.data.length - 1];
            if (rsi === null || rsi > filters.rsiBelow) return false;
        }
        if (filters.rsiAbove) {
            const rsi = stock.indicators.rsi[stock.data.length - 1];
            if (rsi === null || rsi < filters.rsiAbove) return false;
        }

        // Volume filter
        if (filters.volumeAbove) {
            if (stock.volume < filters.volumeAbove) return false;
        }

        // Bandar filter
        if (filters.bandarPhase) {
            if (!stock.bandar?.overallPhase?.includes(filters.bandarPhase)) return false;
        }

        // Entry recommendation
        if (filters.entryOnly) {
            if (!stock.entryPoint.recommendation.includes('ENTRY')) return false;
        }

        return true;
    });
}
