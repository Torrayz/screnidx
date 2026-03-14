// ============================================================
//  server.js — Backend proxy using yahoo-finance2 library
//  Handles auth/cookies automatically for real IDX data
// ============================================================

import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ── Chart Data ─────────────────────────────────────────────

app.get('/api/chart/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { range = '6mo', interval = '1d' } = req.query;

    try {
        // Calculate period based on range
        const now = new Date();
        const rangeMap = {
            '1mo': 30, '3mo': 90, '6mo': 180,
            '1y': 365, '2y': 730, '5y': 1825,
        };
        const days = rangeMap[range] || 180;
        const period1 = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const result = await yahooFinance.chart(symbol, {
            period1: period1.toISOString().split('T')[0],
            period2: now.toISOString().split('T')[0],
            interval: interval || '1d',
        });

        if (!result || !result.quotes?.length) {
            return res.status(404).json({ error: 'No data found' });
        }

        // Transform to standard format
        const meta = result.meta || {};
        const data = result.quotes
            .filter(q => q.open && q.high && q.low && q.close)
            .map(q => ({
                time: Math.floor(new Date(q.date).getTime() / 1000),
                date: new Date(q.date).toISOString().split('T')[0],
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume || 0,
                adjClose: q.adjClose || q.close,
            }));

        res.json({
            chart: {
                result: [{
                    meta: {
                        currency: meta.currency || 'IDR',
                        exchangeName: meta.exchangeName || 'JKT',
                        regularMarketPrice: meta.regularMarketPrice || data[data.length - 1]?.close || 0,
                        previousClose: meta.previousClose || meta.chartPreviousClose || 0,
                    },
                    timestamp: data.map(d => d.time),
                    indicators: {
                        quote: [{
                            open: data.map(d => d.open),
                            high: data.map(d => d.high),
                            low: data.map(d => d.low),
                            close: data.map(d => d.close),
                            volume: data.map(d => d.volume),
                        }],
                        adjclose: [{ adjclose: data.map(d => d.adjClose) }],
                    },
                }],
            },
        });
    } catch (err) {
        console.error(`Chart error [${symbol}]:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Quote Data ─────────────────────────────────────────────

app.get('/api/quote', async (req, res) => {
    const { symbols } = req.query;
    if (!symbols) return res.status(400).json({ error: 'symbols required' });

    const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

    try {
        const results = await yahooFinance.quote(symbolList);
        const quoteArray = Array.isArray(results) ? results : [results];

        res.json({
            quoteResponse: {
                result: quoteArray.map(q => ({
                    symbol: q.symbol,
                    shortName: q.shortName || q.longName || q.symbol,
                    longName: q.longName || q.shortName || q.symbol,
                    regularMarketPrice: q.regularMarketPrice || 0,
                    regularMarketChange: q.regularMarketChange || 0,
                    regularMarketChangePercent: q.regularMarketChangePercent || 0,
                    regularMarketVolume: q.regularMarketVolume || 0,
                    averageDailyVolume3Month: q.averageDailyVolume3Month || 0,
                    marketCap: q.marketCap || 0,
                    regularMarketDayHigh: q.regularMarketDayHigh || 0,
                    regularMarketDayLow: q.regularMarketDayLow || 0,
                    regularMarketOpen: q.regularMarketOpen || 0,
                    regularMarketPreviousClose: q.regularMarketPreviousClose || 0,
                    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || 0,
                    fiftyTwoWeekLow: q.fiftyTwoWeekLow || 0,
                    bid: q.bid || 0,
                    ask: q.ask || 0,
                })),
            },
        });
    } catch (err) {
        console.error('Quote error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Search ─────────────────────────────────────────────────

app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q required' });

    try {
        const result = await yahooFinance.search(q, {
            quotesCount: 20,
            newsCount: 0,
        });

        // Filter for Jakarta exchange (.JK)
        const jkResults = (result.quotes || []).filter(q =>
            q.symbol?.endsWith('.JK') || q.exchange === 'JKT'
        );

        res.json({
            quotes: jkResults.map(q => ({
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                type: q.quoteType,
                exchange: q.exchange,
                sector: q.sector || '',
                industry: q.industry || '',
            })),
        });
    } catch (err) {
        console.error('Search error:', err.message);
        res.status(500).json({ error: err.message, quotes: [] });
    }
});

// ── IDX Stock List ─────────────────────────────────────────

let cachedStockList = null;
let stockListTimestamp = 0;
const STOCK_LIST_TTL = 24 * 60 * 60 * 1000;

app.get('/api/idx-stocks', async (req, res) => {
    if (cachedStockList && Date.now() - stockListTimestamp < STOCK_LIST_TTL) {
        return res.json(cachedStockList);
    }

    try {
        // Try Yahoo Finance screener for trending IDX stocks
        const trending = await yahooFinance.search('saham indonesia', {
            quotesCount: 50,
            newsCount: 0,
        });

        const jkStocks = (trending.quotes || [])
            .filter(q => q.symbol?.endsWith('.JK'))
            .map(q => ({
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol.replace('.JK', ''),
                sector: determineSector(q.symbol),
            }));

        // Merge with comprehensive fallback list
        const fallback = getComprehensiveIDXList();
        const seen = new Set(jkStocks.map(s => s.symbol));
        for (const s of fallback) {
            if (!seen.has(s.symbol)) {
                seen.add(s.symbol);
                jkStocks.push(s);
            }
        }

        cachedStockList = { stocks: jkStocks, lastUpdated: new Date().toISOString() };
        stockListTimestamp = Date.now();
        res.json(cachedStockList);
    } catch (err) {
        console.error('IDX stocks error:', err.message);
        res.json({ stocks: getComprehensiveIDXList(), lastUpdated: new Date().toISOString() });
    }
});

// ── Health check ───────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Helpers ────────────────────────────────────────────────

function determineSector(symbol) {
    const sym = symbol.replace('.JK', '');
    const sectorMap = {
        Finance: ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'BRIS', 'ARTO', 'BNGA', 'BDMN', 'MEGA', 'BTPS', 'NISP', 'BBTN', 'BJTM', 'BJBR', 'BTPN', 'BBYB'],
        Consumer: ['UNVR', 'HMSP', 'GGRM', 'ICBP', 'INDF', 'MYOR', 'KLBF', 'SIDO', 'KAEF', 'DVLA', 'TSPC', 'ULTJ', 'CLEO', 'ADES', 'GOOD'],
        Mining: ['ADRO', 'PTBA', 'ANTM', 'INCO', 'MDKA', 'TINS', 'ITMG', 'BUMI', 'DSSA', 'HRUM', 'MBAP'],
        Telekomunikasi: ['TLKM', 'EXCL', 'ISAT', 'FREN', 'TOWR', 'TBIG', 'MTEL'],
        Otomotif: ['ASII', 'AUTO', 'GJTL', 'SMSM', 'IMAS'],
        Infrastruktur: ['SMGR', 'WIKA', 'JSMR', 'WSKT', 'PTPP', 'ADHI', 'WTON', 'SMBR'],
        Energy: ['PGAS', 'MEDC', 'AKRA', 'ELSA', 'RAJA'],
        Technology: ['GOTO', 'BUKA', 'EMTK', 'DCII', 'ATIC'],
        Property: ['BSDE', 'CTRA', 'SMRA', 'LPKR', 'PWON', 'DMAS', 'MKPI', 'DILD'],
        Retail: ['ACES', 'MAPI', 'ERAA', 'RALS', 'LPPF', 'AMRT'],
        Agrikultur: ['CPIN', 'JPFA', 'MAIN', 'AALI', 'LSIP', 'SMAR', 'TBLA'],
        Transportation: ['ASSA', 'BIRD', 'GIAA', 'SMDR', 'TMAS', 'HELI'],
    };

    for (const [sector, symbols] of Object.entries(sectorMap)) {
        if (symbols.includes(sym)) return sector;
    }
    return 'Lainnya';
}

function getComprehensiveIDXList() {
    const stocks = [
        'BBCA', 'BBRI', 'BMRI', 'BBNI', 'BRIS', 'ARTO', 'BNGA', 'BDMN', 'MEGA', 'BTPS', 'NISP', 'BBTN', 'BJTM', 'BJBR',
        'UNVR', 'HMSP', 'GGRM', 'ICBP', 'INDF', 'MYOR', 'KLBF', 'SIDO', 'KAEF', 'DVLA', 'TSPC', 'ULTJ', 'CLEO',
        'ADRO', 'PTBA', 'ANTM', 'INCO', 'MDKA', 'TINS', 'ITMG', 'HRUM', 'MBAP', 'BUMI',
        'TLKM', 'EXCL', 'ISAT', 'FREN', 'TOWR', 'TBIG', 'MTEL',
        'ASII', 'AUTO', 'GJTL', 'SMSM',
        'SMGR', 'WIKA', 'JSMR', 'WSKT', 'PTPP', 'ADHI', 'WTON',
        'PGAS', 'MEDC', 'AKRA', 'ELSA',
        'GOTO', 'BUKA', 'EMTK', 'DCII',
        'BSDE', 'CTRA', 'SMRA', 'LPKR', 'PWON', 'DMAS', 'MKPI',
        'ACES', 'MAPI', 'ERAA', 'RALS', 'LPPF', 'AMRT',
        'CPIN', 'JPFA', 'MAIN', 'AALI', 'LSIP',
        'ASSA', 'BIRD', 'GIAA',
    ];

    return stocks.map(sym => ({
        symbol: `${sym}.JK`,
        name: sym,
        sector: determineSector(`${sym}.JK`),
    }));
}

// ── Start ──────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n🚀 IDX Screener Backend on http://localhost:${PORT}`);
    console.log(`   Powered by yahoo-finance2\n`);
    console.log(`   GET /api/chart/:symbol?range=6mo&interval=1d`);
    console.log(`   GET /api/quote?symbols=BBCA.JK,BBRI.JK`);
    console.log(`   GET /api/search?q=bank`);
    console.log(`   GET /api/idx-stocks`);
    console.log(`   GET /api/health\n`);
});
