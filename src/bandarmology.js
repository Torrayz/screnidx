// ============================================================
//  bandarmology.js — Smart Money & Bandar Tracking
// ============================================================

/**
 * Detect unusual volume (> 2x average)
 */
export function detectUnusualVolume(chartData, multiplier = 2) {
    const volumes = chartData.map(d => d.volume);
    const avgVol20 = [];

    for (let i = 0; i < volumes.length; i++) {
        if (i < 20) {
            let sum = 0;
            for (let j = 0; j <= i; j++) sum += volumes[j];
            avgVol20.push(sum / (i + 1));
        } else {
            let sum = 0;
            for (let j = i - 19; j <= i; j++) sum += volumes[j];
            avgVol20.push(sum / 20);
        }
    }

    return chartData.map((d, i) => ({
        date: d.date,
        volume: d.volume,
        avgVolume: avgVol20[i],
        ratio: avgVol20[i] > 0 ? d.volume / avgVol20[i] : 0,
        isUnusual: d.volume > avgVol20[i] * multiplier,
    }));
}

/**
 * Accumulation / Distribution analysis
 * Based on CLV (Close Location Value) and volume
 */
export function accumulationDistribution(chartData) {
    const result = [];
    let cumAD = 0;

    for (let i = 0; i < chartData.length; i++) {
        const { high, low, close, volume } = chartData[i];
        const range = high - low;
        // CLV: Close Location Value
        const clv = range === 0 ? 0 : ((close - low) - (high - close)) / range;
        const adValue = clv * volume;
        cumAD += adValue;

        result.push({
            date: chartData[i].date,
            clv,
            adValue,
            cumAD,
            // Positive CLV = accumulation, negative = distribution
            phase: clv > 0.3 ? 'ACCUMULATION' : clv < -0.3 ? 'DISTRIBUTION' : 'NEUTRAL',
        });
    }
    return result;
}

/**
 * Smart money detection via price-volume divergence
 * When price drops but volume increases AND close near high → smart money buying
 * When price rises but volume decreases → distribution possible
 */
export function smartMoneyDetection(chartData) {
    const results = [];

    for (let i = 1; i < chartData.length; i++) {
        const prev = chartData[i - 1];
        const curr = chartData[i];
        const priceChange = ((curr.close - prev.close) / prev.close) * 100;
        const volChange = prev.volume > 0 ? ((curr.volume - prev.volume) / prev.volume) * 100 : 0;
        const range = curr.high - curr.low;
        const upperWick = range > 0 ? (curr.high - Math.max(curr.open, curr.close)) / range : 0;
        const lowerWick = range > 0 ? (Math.min(curr.open, curr.close) - curr.low) / range : 0;
        const bodyRatio = range > 0 ? Math.abs(curr.close - curr.open) / range : 0;

        let signal = 'NEUTRAL';
        let description = '';

        // Smart money buying: price down/flat, volume up, close near high
        if (priceChange <= 0 && volChange > 50 && curr.close > (curr.high + curr.low) / 2) {
            signal = 'SMART_BUY';
            description = 'Volume naik signifikan saat harga turun, close dekat high — potensi akumulasi bandar';
        }
        // Smart money selling: price up, volume up significantly, long upper wick
        else if (priceChange > 0 && volChange > 50 && upperWick > 0.4) {
            signal = 'SMART_SELL';
            description = 'Harga naik dengan upper wick panjang & volume tinggi — distribusi bandar';
        }
        // Quiet accumulation: low volume, small body, lower wick
        else if (volChange < -30 && bodyRatio < 0.3 && lowerWick > 0.4) {
            signal = 'QUIET_ACCUMULATION';
            description = 'Volume rendah, body kecil, lower wick — akumulasi diam-diam';
        }
        // Breakout with volume
        else if (priceChange > 3 && volChange > 100) {
            signal = 'BREAKOUT';
            description = 'Breakout harga dengan volume sangat tinggi — momentum kuat';
        }

        results.push({
            date: curr.date,
            priceChange: priceChange.toFixed(2),
            volChange: volChange.toFixed(2),
            signal,
            description,
        });
    }
    return results;
}

/**
 * Estimate foreign vs domestic flow
 * (Simplified estimation based on volume patterns)
 */
export function estimateForeignFlow(chartData) {
    const results = [];

    for (let i = 0; i < chartData.length; i++) {
        const { open, high, low, close, volume } = chartData[i];
        const range = high - low;
        const clv = range === 0 ? 0 : ((close - low) - (high - close)) / range;

        // Estimate: higher volume with positive CLV suggests foreign buying
        // This is a simplification — real data requires broker summary
        const estimatedForeignRatio = Math.max(0, Math.min(1, 0.5 + clv * 0.3));
        const estimatedForeignVol = Math.round(volume * estimatedForeignRatio);
        const estimatedDomesticVol = volume - estimatedForeignVol;

        results.push({
            date: chartData[i].date,
            totalVolume: volume,
            estimatedForeignVol,
            estimatedDomesticVol,
            foreignRatio: (estimatedForeignRatio * 100).toFixed(1),
            netFlow: close >= open ? 'INFLOW' : 'OUTFLOW',
        });
    }
    return results;
}

/**
 * Generate bandarmology summary
 */
export function getBandarmologySummary(chartData) {
    if (!chartData || chartData.length < 5) return null;

    const unusualVol = detectUnusualVolume(chartData);
    const ad = accumulationDistribution(chartData);
    const smartMoney = smartMoneyDetection(chartData);
    const foreignFlow = estimateForeignFlow(chartData);

    // Recent signals (last 10 days)
    const recentSmartMoney = smartMoney.slice(-10);
    const recentUnusualVol = unusualVol.slice(-10).filter(v => v.isUnusual);

    // Overall phase
    const recentAD = ad.slice(-10);
    const accCount = recentAD.filter(a => a.phase === 'ACCUMULATION').length;
    const distCount = recentAD.filter(a => a.phase === 'DISTRIBUTION').length;

    let overallPhase = 'NEUTRAL';
    if (accCount >= 6) overallPhase = 'ACCUMULATION';
    else if (distCount >= 6) overallPhase = 'DISTRIBUTION';
    else if (accCount > distCount) overallPhase = 'EARLY_ACCUMULATION';
    else if (distCount > accCount) overallPhase = 'EARLY_DISTRIBUTION';

    // Smart money signals count
    const smartBuys = recentSmartMoney.filter(s => s.signal === 'SMART_BUY' || s.signal === 'QUIET_ACCUMULATION').length;
    const smartSells = recentSmartMoney.filter(s => s.signal === 'SMART_SELL').length;
    const breakouts = recentSmartMoney.filter(s => s.signal === 'BREAKOUT').length;

    // Money flow
    const recentForeign = foreignFlow.slice(-10);
    const inflowDays = recentForeign.filter(f => f.netFlow === 'INFLOW').length;

    // Bandar meter (0-100)
    let bandarMeter = 50;
    bandarMeter += (accCount - distCount) * 5;
    bandarMeter += (smartBuys - smartSells) * 10;
    bandarMeter += breakouts * 8;
    bandarMeter += (inflowDays - 5) * 3;
    bandarMeter = Math.max(0, Math.min(100, bandarMeter));

    return {
        overallPhase,
        bandarMeter,
        unusualVolumeCount: recentUnusualVol.length,
        smartBuys,
        smartSells,
        breakouts,
        inflowDays,
        outflowDays: 10 - inflowDays,
        recentSignals: recentSmartMoney.filter(s => s.signal !== 'NEUTRAL').slice(-5),
        unusualVolDays: recentUnusualVol.slice(-5),
        adData: ad,
        foreignFlowData: foreignFlow,
    };
}
