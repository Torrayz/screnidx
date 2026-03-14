// ============================================================
//  api.js — Data service with backend proxy for real IDX data
// ============================================================

// Backend proxy (runs on port 3001)
const API_BASE = 'http://localhost:3001/api';

// Comprehensive IDX stocks (fallback if backend unavailable)
const FALLBACK_STOCKS = [
    { symbol: 'BBCA.JK', name: 'Bank Central Asia', sector: 'Finance' },
    { symbol: 'BBRI.JK', name: 'Bank Rakyat Indonesia', sector: 'Finance' },
    { symbol: 'BMRI.JK', name: 'Bank Mandiri', sector: 'Finance' },
    { symbol: 'BBNI.JK', name: 'Bank Negara Indonesia', sector: 'Finance' },
    { symbol: 'BRIS.JK', name: 'Bank Syariah Indonesia', sector: 'Finance' },
    { symbol: 'ARTO.JK', name: 'Bank Jago', sector: 'Finance' },
    { symbol: 'BBTN.JK', name: 'Bank Tabungan Negara', sector: 'Finance' },
    { symbol: 'BNGA.JK', name: 'Bank CIMB Niaga', sector: 'Finance' },
    { symbol: 'BDMN.JK', name: 'Bank Danamon', sector: 'Finance' },
    { symbol: 'MEGA.JK', name: 'Bank Mega', sector: 'Finance' },
    { symbol: 'TLKM.JK', name: 'Telkom Indonesia', sector: 'Telekomunikasi' },
    { symbol: 'EXCL.JK', name: 'XL Axiata', sector: 'Telekomunikasi' },
    { symbol: 'ISAT.JK', name: 'Indosat Ooredoo', sector: 'Telekomunikasi' },
    { symbol: 'TOWR.JK', name: 'Sarana Menara Nusantara', sector: 'Telekomunikasi' },
    { symbol: 'TBIG.JK', name: 'Tower Bersama', sector: 'Telekomunikasi' },
    { symbol: 'ASII.JK', name: 'Astra International', sector: 'Otomotif' },
    { symbol: 'AUTO.JK', name: 'Astra Otoparts', sector: 'Otomotif' },
    { symbol: 'UNVR.JK', name: 'Unilever Indonesia', sector: 'Consumer' },
    { symbol: 'HMSP.JK', name: 'HM Sampoerna', sector: 'Consumer' },
    { symbol: 'GGRM.JK', name: 'Gudang Garam', sector: 'Consumer' },
    { symbol: 'ICBP.JK', name: 'Indofood CBP', sector: 'Consumer' },
    { symbol: 'INDF.JK', name: 'Indofood Sukses Makmur', sector: 'Consumer' },
    { symbol: 'MYOR.JK', name: 'Mayora Indah', sector: 'Consumer' },
    { symbol: 'KLBF.JK', name: 'Kalbe Farma', sector: 'Farmasi' },
    { symbol: 'SIDO.JK', name: 'Industri Jamu Sido Muncul', sector: 'Farmasi' },
    { symbol: 'CPIN.JK', name: 'Charoen Pokphand', sector: 'Agrikultur' },
    { symbol: 'JPFA.JK', name: 'Japfa Comfeed', sector: 'Agrikultur' },
    { symbol: 'AALI.JK', name: 'Astra Agro Lestari', sector: 'Agrikultur' },
    { symbol: 'ADRO.JK', name: 'Adaro Energy', sector: 'Mining' },
    { symbol: 'PTBA.JK', name: 'Bukit Asam', sector: 'Mining' },
    { symbol: 'ANTM.JK', name: 'Aneka Tambang', sector: 'Mining' },
    { symbol: 'INCO.JK', name: 'Vale Indonesia', sector: 'Mining' },
    { symbol: 'MDKA.JK', name: 'Merdeka Copper Gold', sector: 'Mining' },
    { symbol: 'TINS.JK', name: 'Timah', sector: 'Mining' },
    { symbol: 'ITMG.JK', name: 'Indo Tambangraya Megah', sector: 'Mining' },
    { symbol: 'HRUM.JK', name: 'Harum Energy', sector: 'Mining' },
    { symbol: 'PGAS.JK', name: 'Perusahaan Gas Negara', sector: 'Energy' },
    { symbol: 'MEDC.JK', name: 'Medco Energi', sector: 'Energy' },
    { symbol: 'AKRA.JK', name: 'AKR Corporindo', sector: 'Energy' },
    { symbol: 'SMGR.JK', name: 'Semen Indonesia', sector: 'Infrastruktur' },
    { symbol: 'WIKA.JK', name: 'Wijaya Karya', sector: 'Infrastruktur' },
    { symbol: 'JSMR.JK', name: 'Jasa Marga', sector: 'Infrastruktur' },
    { symbol: 'WSKT.JK', name: 'Waskita Karya', sector: 'Infrastruktur' },
    { symbol: 'PTPP.JK', name: 'PP (Persero)', sector: 'Infrastruktur' },
    { symbol: 'GOTO.JK', name: 'Goto Gojek Tokopedia', sector: 'Technology' },
    { symbol: 'BUKA.JK', name: 'Bukalapak', sector: 'Technology' },
    { symbol: 'EMTK.JK', name: 'Elang Mahkota Teknologi', sector: 'Technology' },
    { symbol: 'BSDE.JK', name: 'Bumi Serpong Damai', sector: 'Property' },
    { symbol: 'CTRA.JK', name: 'Ciputra Development', sector: 'Property' },
    { symbol: 'SMRA.JK', name: 'Summarecon Agung', sector: 'Property' },
    { symbol: 'PWON.JK', name: 'Pakuwon Jati', sector: 'Property' },
    { symbol: 'ACES.JK', name: 'Ace Hardware Indonesia', sector: 'Retail' },
    { symbol: 'MAPI.JK', name: 'Mitra Adiperkasa', sector: 'Retail' },
    { symbol: 'ERAA.JK', name: 'Erajaya Swasembada', sector: 'Retail' },
    { symbol: 'AMRT.JK', name: 'Sumber Alfaria Trijaya', sector: 'Retail' },
    { symbol: 'LPPF.JK', name: 'Matahari Department Store', sector: 'Retail' },
    { symbol: 'ASSA.JK', name: 'Adi Sarana Armada', sector: 'Transportation' },
    { symbol: 'BIRD.JK', name: 'Blue Bird', sector: 'Transportation' },
    { symbol: 'MTEL.JK', name: 'Dayamitra Telekomunikasi', sector: 'Telekomunikasi' },
    { symbol: 'FREN.JK', name: 'Smartfren Telecom', sector: 'Telekomunikasi' },
];

// Dynamic stock list (loaded from backend)
export let IDX_STOCKS = [...FALLBACK_STOCKS];

// Computed sectors
export let SECTORS = [...new Set(IDX_STOCKS.map(s => s.sector))];

// Track if backend is available
let backendAvailable = null; // null = unknown, true/false after test

// Cache
const cache = new Map();
const CACHE_TTL = 25_000; // 25 seconds

function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    return null;
}
function setCache(key, data) {
    cache.set(key, { data, ts: Date.now() });
}

/**
 * Check if backend proxy is running
 */
async function checkBackend() {
    if (backendAvailable !== null) return backendAvailable;
    try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        backendAvailable = res.ok;
    } catch {
        backendAvailable = false;
    }
    console.log(`Backend proxy: ${backendAvailable ? '✅ Connected' : '❌ Not available (using demo data)'}`);
    return backendAvailable;
}

/**
 * Load full IDX stock list from backend
 */
export async function loadIDXStocks() {
    if (!(await checkBackend())) return;

    try {
        const res = await fetch(`${API_BASE}/idx-stocks`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.stocks?.length > 0) {
            // Merge with fallback names
            const nameMap = new Map(FALLBACK_STOCKS.map(s => [s.symbol, s.name]));
            IDX_STOCKS = data.stocks.map(s => ({
                ...s,
                name: nameMap.get(s.symbol) || s.name || s.symbol.replace('.JK', ''),
            }));
            SECTORS = [...new Set(IDX_STOCKS.map(s => s.sector))].sort();
            console.log(`Loaded ${IDX_STOCKS.length} IDX stocks from backend`);
        }
    } catch (e) {
        console.warn('Failed to load IDX stock list:', e);
    }
}

/**
 * Search for stocks (via backend Yahoo Finance search)
 */
export async function searchStocks(query) {
    if (!query || query.length < 1) return [];

    const q = query.toUpperCase().trim();

    // Always search local list first
    const localResults = IDX_STOCKS.filter(s =>
        s.symbol.replace('.JK', '').includes(q) ||
        s.name.toUpperCase().includes(q) ||
        s.sector.toUpperCase().includes(q)
    ).slice(0, 10);

    // If backend available, also search Yahoo Finance for more results
    if (await checkBackend()) {
        try {
            const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query + ' .JK')}`);
            if (res.ok) {
                const data = await res.json();
                const remoteResults = (data.quotes || []).map(q => ({
                    symbol: q.symbol,
                    name: q.name || q.symbol.replace('.JK', ''),
                    sector: q.sector || 'Lainnya',
                    fromSearch: true,
                }));

                // Merge: local first, then remote (deduplicated)
                const seen = new Set(localResults.map(s => s.symbol));
                const merged = [...localResults];
                for (const r of remoteResults) {
                    if (!seen.has(r.symbol)) {
                        seen.add(r.symbol);
                        merged.push(r);
                    }
                }
                return merged.slice(0, 15);
            }
        } catch {
            // Ignore search errors
        }
    }

    return localResults;
}

/**
 * Fetch chart data — prefers backend proxy, falls back to demo
 */
export async function fetchChartData(symbol, range = '6mo', interval = '1d') {
    const cacheKey = `chart_${symbol}_${range}_${interval}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // Try backend proxy first
    if (await checkBackend()) {
        try {
            const res = await fetch(`${API_BASE}/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`);
            if (res.ok) {
                const json = await res.json();
                const result = json.chart?.result?.[0];
                if (result) {
                    const timestamps = result.timestamp || [];
                    const quote = result.indicators?.quote?.[0] || {};
                    const adjClose = result.indicators?.adjclose?.[0]?.adjclose || quote.close || [];

                    const data = timestamps.map((t, i) => ({
                        time: t,
                        date: new Date(t * 1000).toISOString().split('T')[0],
                        open: quote.open?.[i] ?? 0,
                        high: quote.high?.[i] ?? 0,
                        low: quote.low?.[i] ?? 0,
                        close: quote.close?.[i] ?? 0,
                        volume: quote.volume?.[i] ?? 0,
                        adjClose: adjClose[i] ?? quote.close?.[i] ?? 0,
                    })).filter(d => d.open && d.high && d.low && d.close);

                    const meta = result.meta || {};
                    const output = {
                        symbol,
                        currency: meta.currency || 'IDR',
                        exchangeName: meta.exchangeName || 'JKT',
                        regularMarketPrice: meta.regularMarketPrice || 0,
                        previousClose: meta.previousClose || meta.chartPreviousClose || 0,
                        data,
                        isDemo: false,
                    };

                    setCache(cacheKey, output);
                    return output;
                }
            }
        } catch (err) {
            console.warn(`Backend chart fetch failed for ${symbol}:`, err.message);
        }
    }

    // Fallback to demo data
    console.info(`Using demo data for ${symbol}`);
    const demoData = generateDemoData(symbol, range);
    setCache(cacheKey, demoData);
    return demoData;
}

/**
 * Fetch quote data — prefers backend proxy
 */
export async function fetchQuote(symbol) {
    const cacheKey = `quote_${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    if (await checkBackend()) {
        try {
            const res = await fetch(`${API_BASE}/quote?symbols=${encodeURIComponent(symbol)}`);
            if (res.ok) {
                const json = await res.json();
                const q = json.quoteResponse?.result?.[0];
                if (q) {
                    const output = {
                        symbol: q.symbol,
                        name: q.shortName || q.longName || symbol,
                        price: q.regularMarketPrice || 0,
                        change: q.regularMarketChange || 0,
                        changePercent: q.regularMarketChangePercent || 0,
                        volume: q.regularMarketVolume || 0,
                        avgVolume: q.averageDailyVolume3Month || 0,
                        marketCap: q.marketCap || 0,
                        high: q.regularMarketDayHigh || 0,
                        low: q.regularMarketDayLow || 0,
                        open: q.regularMarketOpen || 0,
                        previousClose: q.regularMarketPreviousClose || 0,
                        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || 0,
                        fiftyTwoWeekLow: q.fiftyTwoWeekLow || 0,
                        isDemo: false,
                    };
                    setCache(cacheKey, output);
                    return output;
                }
            }
        } catch (err) {
            console.warn(`Quote fetch failed for ${symbol}:`, err.message);
        }
    }

    return null;
}

/**
 * Batch fetch multiple quotes — prefers backend proxy
 */
export async function fetchMultipleQuotes(symbols) {
    const cacheKey = `multi_${symbols.join(',')}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    if (await checkBackend()) {
        try {
            // Batch in groups of 10 to avoid URL length issues
            const batches = [];
            for (let i = 0; i < symbols.length; i += 10) {
                batches.push(symbols.slice(i, i + 10));
            }

            const allQuotes = [];
            for (const batch of batches) {
                const res = await fetch(`${API_BASE}/quote?symbols=${encodeURIComponent(batch.join(','))}`);
                if (res.ok) {
                    const json = await res.json();
                    const results = json.quoteResponse?.result || [];
                    allQuotes.push(...results.map(q => ({
                        symbol: q.symbol,
                        name: q.shortName || q.longName || q.symbol,
                        price: q.regularMarketPrice || 0,
                        change: q.regularMarketChange || 0,
                        changePercent: q.regularMarketChangePercent || 0,
                        volume: q.regularMarketVolume || 0,
                        avgVolume: q.averageDailyVolume3Month || 0,
                        marketCap: q.marketCap || 0,
                        high: q.regularMarketDayHigh || 0,
                        low: q.regularMarketDayLow || 0,
                        open: q.regularMarketOpen || 0,
                        previousClose: q.regularMarketPreviousClose || 0,
                    })));
                }
            }

            if (allQuotes.length > 0) {
                setCache(cacheKey, allQuotes);
                return allQuotes;
            }
        } catch (err) {
            console.warn('Multi-quote fetch failed:', err.message);
        }
    }

    // Fallback: generate from chart data
    const demoQuotes = [];
    for (const sym of symbols) {
        const chart = await fetchChartData(sym, '1mo');
        if (chart && chart.data.length > 1) {
            const last = chart.data[chart.data.length - 1];
            const prev = chart.data[chart.data.length - 2];
            const change = last.close - prev.close;
            const changePct = (change / prev.close) * 100;
            demoQuotes.push({
                symbol: sym,
                name: IDX_STOCKS.find(s => s.symbol === sym)?.name || sym,
                price: last.close,
                change,
                changePercent: changePct,
                volume: last.volume,
                avgVolume: chart.data.slice(-20).reduce((s, d) => s + d.volume, 0) / 20,
                marketCap: 0,
                high: last.high,
                low: last.low,
                open: last.open,
                previousClose: prev.close,
            });
        }
    }
    setCache(cacheKey, demoQuotes);
    return demoQuotes;
}

/**
 * Generate realistic demo data (only used when backend is unavailable)
 */
function generateDemoData(symbol, range = '6mo') {
    const seedPrices = {
        'BBCA.JK': 9800, 'BBRI.JK': 5600, 'BMRI.JK': 6500, 'BBNI.JK': 5100,
        'TLKM.JK': 3800, 'ASII.JK': 5200, 'UNVR.JK': 3400, 'HMSP.JK': 790,
        'GGRM.JK': 25000, 'ICBP.JK': 10600, 'INDF.JK': 6700, 'KLBF.JK': 1600,
        'CPIN.JK': 5000, 'ADRO.JK': 2700, 'PTBA.JK': 2800, 'ANTM.JK': 1500,
        'INCO.JK': 3900, 'PGAS.JK': 1700, 'SMGR.JK': 4100, 'WIKA.JK': 390,
        'JSMR.JK': 4300, 'EXCL.JK': 2400, 'ISAT.JK': 7800, 'MDKA.JK': 2300,
        'ACES.JK': 820, 'MAPI.JK': 1700, 'ERAA.JK': 540, 'BRIS.JK': 2700,
        'ARTO.JK': 2600, 'GOTO.JK': 84,
    };

    const basePrice = seedPrices[symbol] || 1000;
    const rangeDays = { '1mo': 22, '3mo': 66, '6mo': 132, '1y': 252, '2y': 504, '5y': 1260 };
    const days = rangeDays[range] || 132;

    const data = [];
    let price = basePrice * (0.85 + Math.random() * 0.15);
    const now = new Date();

    let seed = 0;
    for (let c of symbol) seed += c.charCodeAt(0);
    const seededRandom = () => {
        seed = (seed * 16807 + 7) % 2147483647;
        return (seed & 0x7fffffff) / 0x7fffffff;
    };

    const trendPhaseLen = Math.floor(days / 4);
    const trends = Array.from({ length: 5 }, () => (seededRandom() - 0.45) * 0.003);

    for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) continue;

        const trendIdx = Math.min(Math.floor((days - i) / trendPhaseLen), trends.length - 1);
        const trend = trends[trendIdx];
        const volatility = basePrice * (0.015 + seededRandom() * 0.02);
        const change = trend * price + (seededRandom() - 0.5) * volatility;
        price = Math.max(price * 0.7, price + change);

        const dayVol = volatility / price;
        const open = price * (1 + (seededRandom() - 0.5) * dayVol * 0.5);
        const high = Math.max(open, price) * (1 + seededRandom() * dayVol * 0.6);
        const low = Math.min(open, price) * (1 - seededRandom() * dayVol * 0.6);
        const close = price;

        const baseVol = basePrice > 5000 ? 8_000_000 : basePrice > 1000 ? 20_000_000 : 100_000_000;
        const volMult = seededRandom() < 0.1 ? (2 + seededRandom() * 3) : (0.5 + seededRandom());
        const volume = Math.round(baseVol * volMult);

        const lot = basePrice >= 5000 ? 25 : basePrice >= 500 ? 5 : 1;
        const roundTo = (v) => Math.round(v / lot) * lot;

        data.push({
            time: Math.floor(date.getTime() / 1000),
            date: date.toISOString().split('T')[0],
            open: roundTo(open),
            high: roundTo(high),
            low: roundTo(low),
            close: roundTo(close),
            volume,
            adjClose: roundTo(close),
        });
    }

    const lastClose = data.length > 0 ? data[data.length - 1].close : basePrice;
    const prevClose = data.length > 1 ? data[data.length - 2].close : lastClose;

    return {
        symbol,
        currency: 'IDR',
        exchangeName: 'JKT',
        regularMarketPrice: lastClose,
        previousClose: prevClose,
        data,
        isDemo: true,
    };
}

/**
 * Format IDR currency
 */
export function formatIDR(value) {
    if (value >= 1e12) return `Rp${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `Rp${(value / 1e9).toFixed(1)}M`;
    if (value >= 1e6) return `Rp${(value / 1e6).toFixed(1)}Jt`;
    return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}

/**
 * Fetch full Python-computed analysis from backend
 * Returns indicators, techSummary, candlePatterns, prediction, volumeProfile, entryPoint
 */
export async function fetchAnalysis(symbol, period = '6mo') {
    const cacheKey = `analysis_${symbol}_${period}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    if (await checkBackend()) {
        try {
            const res = await fetch(`${API_BASE}/analyze/${encodeURIComponent(symbol)}?period=${period}`);
            if (res.ok) {
                const data = await res.json();
                setCache(cacheKey, data);
                return data;
            }
        } catch (err) {
            console.warn(`Analysis fetch failed for ${symbol}:`, err.message);
        }
    }
    return null;
}

/**
 * Format volume
 */
export function formatVolume(vol) {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
    return vol.toString();
}
