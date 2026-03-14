// ============================================================
//  main.js — IDX Screener Pro Application
// ============================================================
import './style.css';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { IDX_STOCKS, SECTORS, fetchChartData, fetchQuote, fetchMultipleQuotes, formatIDR, formatVolume, searchStocks, loadIDXStocks, fetchAnalysis } from './api.js';
import { calculateAllIndicators, getTechnicalSummary, SMA } from './indicators.js';
import { getBandarmologySummary } from './bandarmology.js';
import { screenStock, filterStocks } from './screening.js';
import { analyzeEOD, calculateMarketBreadth } from './eod.js';

// ── State ──────────────────────────────────────────────────

let state = {
  selectedSymbol: 'BBCA.JK',
  chartRange: '6mo',
  chartData: null,
  quote: null,
  indicators: null,
  techSummary: null,
  bandar: null,
  entryPoint: null,
  screenedStocks: [],
  chart: null,
  candleSeries: null,
  volumeSeries: null,
  refreshInterval: null,
  activeTab: 'technical',
  filters: {},
  eodData: null,
  marketBreadth: null,
};

// ── Initialize ─────────────────────────────────────────────

async function init() {
  renderLayout();
  bindEvents();

  // Load IDX stock list from backend (extended list)
  loadIDXStocks().then(() => {
    // Re-render watchlist with updated stock list
    renderWatchlist();
  });

  // Load initial data
  try {
    await loadStockData(state.selectedSymbol);
  } catch (e) {
    console.error('Init load failed:', e);
  }

  // Always remove loading overlay
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 600);
  }

  // Re-render chart after overlay removed
  setTimeout(() => {
    if (state.chartData) {
      updateChart(state.chartData.data);
    }
  }, 700);

  // Auto-refresh every 30s
  state.refreshInterval = setInterval(() => {
    loadStockData(state.selectedSymbol, true);
  }, 30000);
}

// ── Render Layout ──────────────────────────────────────────

function renderLayout() {
  document.querySelector('#app').innerHTML = `
    <!-- Loading -->
    <div id="loading-overlay" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">IDX Screener Pro</div>
      <div class="loading-subtext">Memuat data pasar...</div>
    </div>

    <!-- Header -->
    <header class="header">
      <div class="header-brand">
        <div class="header-logo">IX</div>
        <div>
          <div class="header-title">IDX Screener Pro</div>
          <div class="header-subtitle">Screening Saham Indonesia Real-Time</div>
        </div>
      </div>
      <div class="header-controls">
        <div class="search-container">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="search-input" placeholder="Cari saham... (BBCA, TLKM, ...)" autocomplete="off">
          <div class="search-dropdown" id="search-dropdown"></div>
        </div>
        <div class="status-badge status-live">LIVE</div>
        <button class="btn" id="btn-refresh" title="Refresh Data">
          <span class="icon">🔄</span> Refresh
        </button>
      </div>
    </header>

    <!-- Main -->
    <div class="main-layout">
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">📋 Watchlist</div>
          <div id="watchlist"></div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-title">🔍 Filter Screener</div>
          <div class="filter-group">
            <label class="filter-label">Sinyal</label>
            <select class="filter-select" id="filter-signal">
              <option value="">Semua</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
              <option value="NEUTRAL">Netral</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Sektor</label>
            <select class="filter-select" id="filter-sector">
              <option value="">Semua</option>
              ${SECTORS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">RSI di bawah</label>
            <input type="number" class="filter-input" id="filter-rsi" placeholder="30" min="0" max="100">
          </div>
          <div class="filter-group">
            <label class="filter-label">Fase Bandar</label>
            <select class="filter-select" id="filter-bandar">
              <option value="">Semua</option>
              <option value="ACCUMULATION">Akumulasi</option>
              <option value="DISTRIBUTION">Distribusi</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">
              <input type="checkbox" id="filter-entry-only"> Hanya Entry Point
            </label>
          </div>
          <button class="btn btn-primary" id="btn-screen" style="width:100%;justify-content:center;margin-top:var(--space-md)">
            🔍 Jalankan Screener
          </button>
        </div>
      </aside>

      <!-- Content -->
      <main class="content" id="content">
        <!-- Stock Header -->
        <div class="stock-header animate-in" id="stock-header">
          <div class="stock-info">
            <h1 id="stock-symbol">—</h1>
            <div class="stock-name" id="stock-name">Memuat...</div>
          </div>
          <div class="stock-price-main">
            <div class="stock-price-value" id="stock-price">—</div>
            <div class="stock-price-change" id="stock-change">—</div>
          </div>
        </div>

        <!-- Chart -->
        <div class="card animate-in delay-1">
          <div class="card-title">📊 Chart Harga</div>
          <div class="chart-controls" id="chart-controls">
            <button class="chart-range-btn" data-range="1mo">1B</button>
            <button class="chart-range-btn" data-range="3mo">3B</button>
            <button class="chart-range-btn active" data-range="6mo">6B</button>
            <button class="chart-range-btn" data-range="1y">1T</button>
            <button class="chart-range-btn" data-range="2y">2T</button>
            <button class="chart-range-btn" data-range="5y">5T</button>
          </div>
          <div class="chart-container" id="chart-container" style="height:400px"></div>
        </div>

        <!-- Tabs -->
        <div class="tabs" id="main-tabs">
          <button class="tab-btn active" data-tab="technical">📈 Teknikal</button>
          <button class="tab-btn" data-tab="entry">🎯 Entry Point</button>
          <button class="tab-btn" data-tab="money">💰 Money Flow</button>
          <button class="tab-btn" data-tab="bandar">🏦 Bandarmology</button>
          <button class="tab-btn" data-tab="eod">🔮 EOD Prediksi</button>
          <button class="tab-btn" data-tab="screener">📋 Screener</button>
        </div>

        <!-- Tab Content -->
        <div id="tab-content"></div>
      </main>
    </div>
  `;

  // Initial watchlist
  renderWatchlist();
}

// ── Render Watchlist ───────────────────────────────────────

function renderWatchlist() {
  const container = document.getElementById('watchlist');
  if (!container) return;

  const defaultStocks = IDX_STOCKS.slice(0, 15);
  container.innerHTML = defaultStocks.map(s => `
    <div class="watchlist-item ${s.symbol === state.selectedSymbol ? 'active' : ''}" data-symbol="${s.symbol}">
      <div>
        <div class="watchlist-symbol">${s.symbol.replace('.JK', '')}</div>
        <div style="font-size:0.65rem;color:var(--text-muted)">${s.sector}</div>
      </div>
      <div style="text-align:right">
        <div class="watchlist-price" id="wp-${s.symbol.replace('.', '_')}">—</div>
        <div class="watchlist-change" id="wc-${s.symbol.replace('.', '_')}">—</div>
      </div>
    </div>
  `).join('');

  // Load prices
  loadWatchlistPrices(defaultStocks.map(s => s.symbol));
}

async function loadWatchlistPrices(symbols) {
  const quotes = await fetchMultipleQuotes(symbols);
  quotes.forEach(q => {
    const priceEl = document.getElementById(`wp-${q.symbol.replace('.', '_')}`);
    const changeEl = document.getElementById(`wc-${q.symbol.replace('.', '_')}`);
    if (priceEl) priceEl.textContent = formatIDR(q.price);
    if (changeEl) {
      changeEl.textContent = `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`;
      changeEl.className = `watchlist-change ${q.changePercent >= 0 ? 'positive' : 'negative'}`;
    }
  });
}

// ── Load Stock Data ────────────────────────────────────────

async function loadStockData(symbol, silent = false) {
  state.selectedSymbol = symbol;

  // Fetch chart data and quote
  const [chartResult, quote] = await Promise.all([
    fetchChartData(symbol, state.chartRange),
    fetchQuote(symbol),
  ]);

  if (!chartResult || !chartResult.data.length) return;

  state.chartData = chartResult;
  state.quote = quote;

  // ─── Sync prices: use quote price as current price (more accurate) ───
  if (quote && quote.price && chartResult.data.length > 0) {
    const lastCandle = chartResult.data[chartResult.data.length - 1];
    // Update chart's meta price to match quote
    chartResult.regularMarketPrice = quote.price;
    chartResult.previousClose = quote.previousClose || chartResult.previousClose;
  }

  // ─── Try Python analysis first (more accurate with pandas+ta) ───
  const pyAnalysis = await fetchAnalysis(symbol, state.chartRange);

  if (pyAnalysis) {
    // Use Python-computed analysis
    console.log('📊 Using Python analysis (pandas + ta)');

    // Map Python indicators to the format our JS rendering expects
    state.indicators = {
      sma: {
        sma5: pyAnalysis.indicators.sma5 || [],
        sma10: pyAnalysis.indicators.sma10 || [],
        sma20: pyAnalysis.indicators.sma20 || [],
        sma50: pyAnalysis.indicators.sma50 || [],
        sma200: pyAnalysis.indicators.sma200 || [],
      },
      ema: {
        ema12: pyAnalysis.indicators.ema12 || [],
        ema26: pyAnalysis.indicators.ema26 || [],
      },
      rsi: pyAnalysis.indicators.rsi || [],
      macd: {
        macd: pyAnalysis.indicators.macd || [],
        signal: pyAnalysis.indicators.macd_signal || [],
        histogram: pyAnalysis.indicators.macd_histogram || [],
      },
      bb: {
        upper: pyAnalysis.indicators.bb_upper || [],
        middle: pyAnalysis.indicators.bb_middle || [],
        lower: pyAnalysis.indicators.bb_lower || [],
      },
      stoch: {
        k: pyAnalysis.indicators.stoch_k || [],
        d: pyAnalysis.indicators.stoch_d || [],
      },
      adx: {
        adx: pyAnalysis.indicators.adx || [],
        plusDI: pyAnalysis.indicators.adx_pos || [],
        minusDI: pyAnalysis.indicators.adx_neg || [],
      },
      mfi: pyAnalysis.indicators.mfi || [],
      obv: pyAnalysis.indicators.obv || [],
      vwap: pyAnalysis.indicators.vwap || [],
      atr: pyAnalysis.indicators.atr || [],
      cci: pyAnalysis.indicators.cci || [],
      williams_r: pyAnalysis.indicators.williams_r || [],
      pivots: pyAnalysis.entryPoint || null,
    };

    state.techSummary = pyAnalysis.techSummary;

    // Use Python prediction for EOD
    state.eodData = {
      symbol,
      lastPrice: pyAnalysis.lastPrice,
      date: pyAnalysis.date,
      prediction: pyAnalysis.prediction,
      candlePatterns: pyAnalysis.candlePatterns || [],
      volumeProfile: pyAnalysis.volumeProfile,
      techSummary: pyAnalysis.techSummary,
    };

    // Bandar from JS (Python doesn't compute this)
    state.bandar = getBandarmologySummary(chartResult.data);

    // Entry point from Python
    if (pyAnalysis.entryPoint) {
      const ep = pyAnalysis.entryPoint;
      const rsi = pyAnalysis.indicators.rsi;
      const lastRsi = rsi ? rsi[rsi.length - 1] : 50;
      const stopLoss = ep.support * 0.97;
      const currentPrice = quote?.price || pyAnalysis.lastPrice;

      state.entryPoint = {
        currentPrice,
        entryPrice: ep.support,
        entryReason: lastRsi < 30 ? 'Entry saat oversold di dekat support level'
          : currentPrice <= ep.support * 1.02 ? 'Entry di support level dengan konfirmasi volume'
          : 'Harga di area netral, perhatikan level support terdekat',
        stopLoss: Math.round(stopLoss),
        stopLossPercent: ((currentPrice - stopLoss) / currentPrice * 100).toFixed(2),
        target1: ep.resistance,
        target1Percent: ((ep.resistance - currentPrice) / currentPrice * 100).toFixed(2),
        target2: ep.r2 || ep.resistance,
        target2Percent: ((ep.r2 - currentPrice) / currentPrice * 100).toFixed(2),
        riskReward: ((ep.resistance - currentPrice) / (currentPrice - stopLoss)).toFixed(2),
        support: ep.support,
        support2: ep.s2 || ep.s1,
        resistance: ep.resistance,
        resistance2: ep.r2 || ep.resistance,
        recommendation: lastRsi < 35 ? 'ENTRY' : lastRsi > 70 ? 'AVOID (OVERBOUGHT)' : 'WAIT',
        pivots: { pp: ep.pivotPoint, r1: ep.r1, r2: ep.r2, s1: ep.s1, s2: ep.s2 },
      };
    }
  } else {
    // Fallback to JavaScript analysis
    console.log('📊 Using JavaScript analysis (fallback)');
    state.indicators = calculateAllIndicators(chartResult.data);
    state.techSummary = getTechnicalSummary(state.indicators, chartResult.data);
    state.bandar = getBandarmologySummary(chartResult.data);
    const screened = screenStock(chartResult);
    state.entryPoint = screened?.entryPoint;
    state.eodData = analyzeEOD(chartResult);
  }

  // Update UI
  updateStockHeader();
  updateChart(chartResult.data);
  renderTabContent(state.activeTab);
  updateWatchlistActive(symbol);
}

// ── Update Stock Header ────────────────────────────────────

function updateStockHeader() {
  const q = state.quote;
  const stockInfo = IDX_STOCKS.find(s => s.symbol === state.selectedSymbol);

  document.getElementById('stock-symbol').innerHTML = `
    ${state.selectedSymbol.replace('.JK', '')}
    ${state.techSummary ? `<span class="signal-badge signal-${state.techSummary.signal.toLowerCase().replace(' ', '-')}">${state.techSummary.signal}</span>` : ''}
  `;
  const demoLabel = state.chartData?.isDemo ? ' <span style="font-size:0.65rem;padding:2px 6px;background:rgba(245,158,11,0.2);color:var(--yellow);border-radius:4px;margin-left:8px">DEMO DATA</span>' : '';
  document.getElementById('stock-name').innerHTML = (stockInfo?.name || q?.name || state.selectedSymbol) + demoLabel;

  // Update status badge
  const statusBadge = document.querySelector('.status-badge');
  if (statusBadge && state.chartData?.isDemo) {
    statusBadge.textContent = 'DEMO';
    statusBadge.className = 'status-badge';
    statusBadge.style.cssText = 'color:var(--yellow);background:var(--yellow-bg)';
  }

  if (q) {
    document.getElementById('stock-price').textContent = formatIDR(q.price);
    const changeEl = document.getElementById('stock-change');
    const isPositive = q.changePercent >= 0;
    changeEl.innerHTML = `
      <span class="${isPositive ? 'positive' : 'negative'}">
        ${isPositive ? '▲' : '▼'} ${Math.abs(q.change).toFixed(0)} (${isPositive ? '+' : ''}${q.changePercent.toFixed(2)}%)
      </span>
    `;
  } else {
    const lastData = state.chartData?.data;
    if (lastData?.length >= 2) {
      const last = lastData[lastData.length - 1];
      const prev = lastData[lastData.length - 2];
      const change = last.close - prev.close;
      const changePct = (change / prev.close) * 100;
      document.getElementById('stock-price').textContent = formatIDR(last.close);
      const changeEl = document.getElementById('stock-change');
      const isPositive = change >= 0;
      changeEl.innerHTML = `
        <span class="${isPositive ? 'positive' : 'negative'}">
          ${isPositive ? '▲' : '▼'} ${Math.abs(change).toFixed(0)} (${isPositive ? '+' : ''}${changePct.toFixed(2)}%)
        </span>
      `;
    }
  }
}

// ── Chart ──────────────────────────────────────────────────

function updateChart(data) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  // Ensure container has dimensions
  if (container.clientWidth === 0) {
    setTimeout(() => updateChart(data), 200);
    return;
  }

  // Clear old chart
  if (state.chart) {
    try { state.chart.remove(); } catch (e) { }
    state.chart = null;
  }

  container.innerHTML = '';

  // Deduplicate and sort data by date
  const seen = new Set();
  data = data.filter(d => {
    if (seen.has(d.date)) return false;
    seen.add(d.date);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const chart = createChart(container, {
    width: container.clientWidth,
    height: 400,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#9ca3af',
      fontFamily: "'Inter', sans-serif",
    },
    grid: {
      vertLines: { color: 'rgba(55, 65, 81, 0.3)' },
      horzLines: { color: 'rgba(55, 65, 81, 0.3)' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: 'rgba(55, 65, 81, 0.5)',
    },
    timeScale: {
      borderColor: 'rgba(55, 65, 81, 0.5)',
      timeVisible: false,
    },
  });

  // Candlestick
  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#10b981',
    downColor: '#ef4444',
    borderDownColor: '#ef4444',
    borderUpColor: '#10b981',
    wickDownColor: '#ef4444',
    wickUpColor: '#10b981',
  });

  candleSeries.setData(data.map(d => ({
    time: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
  })));

  // Volume
  const volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'vol',
  });

  chart.priceScale('vol').applyOptions({
    scaleMargins: { top: 0.85, bottom: 0 },
  });

  volumeSeries.setData(data.map(d => ({
    time: d.date,
    value: d.volume,
    color: d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
  })));

  // SMA overlays
  if (state.indicators) {
    const sma20Data = state.indicators.sma.sma20
      .map((v, i) => v !== null ? { time: data[i].date, value: v } : null)
      .filter(Boolean);
    const sma50Data = state.indicators.sma.sma50
      .map((v, i) => v !== null ? { time: data[i].date, value: v } : null)
      .filter(Boolean);

    if (sma20Data.length) {
      const sma20Series = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma20Series.setData(sma20Data);
    }

    if (sma50Data.length) {
      const sma50Series = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma50Series.setData(sma50Data);
    }

    // Bollinger Bands
    const bbUpper = state.indicators.bb.upper
      .map((v, i) => v !== null ? { time: data[i].date, value: v } : null)
      .filter(Boolean);
    const bbLower = state.indicators.bb.lower
      .map((v, i) => v !== null ? { time: data[i].date, value: v } : null)
      .filter(Boolean);

    if (bbUpper.length) {
      const bbUpperSeries = chart.addSeries(LineSeries, {
        color: 'rgba(139, 92, 246, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bbUpperSeries.setData(bbUpper);
    }
    if (bbLower.length) {
      const bbLowerSeries = chart.addSeries(LineSeries, {
        color: 'rgba(139, 92, 246, 0.5)',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bbLowerSeries.setData(bbLower);
    }
  }

  // Resize handler
  const ro = new ResizeObserver(() => {
    chart.applyOptions({ width: container.clientWidth });
  });
  ro.observe(container);

  chart.timeScale().fitContent();
  state.chart = chart;
  state.candleSeries = candleSeries;
  state.volumeSeries = volumeSeries;
}

// ── Tab Content ────────────────────────────────────────────

function renderTabContent(tab) {
  state.activeTab = tab;
  const container = document.getElementById('tab-content');
  if (!container) return;

  switch (tab) {
    case 'technical':
      renderTechnicalTab(container);
      break;
    case 'entry':
      renderEntryTab(container);
      break;
    case 'money':
      renderMoneyFlowTab(container);
      break;
    case 'bandar':
      renderBandarTab(container);
      break;
    case 'screener':
      renderScreenerTab(container);
      break;
    case 'eod':
      renderEODTab(container);
      break;
  }
}

// ── Technical Analysis Tab ─────────────────────────────────

function renderTechnicalTab(container) {
  if (!state.indicators || !state.chartData) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div>Memuat data indikator...</div>';
    return;
  }

  const data = state.chartData.data;
  const last = data.length - 1;
  const ind = state.indicators;
  const summary = state.techSummary;

  container.innerHTML = `
    <div class="grid-2 animate-in">
      <!-- Technical Summary -->
      <div class="card">
        <div class="card-title">📊 Ringkasan Teknikal</div>
        <div style="text-align:center; margin-bottom:var(--space-lg)">
          <div class="signal-badge signal-${summary.signal.toLowerCase().replace(' ', '-')}" style="font-size:1rem;padding:var(--space-sm) var(--space-xl)">
            ${summary.signal}
          </div>
          <div style="margin-top:var(--space-md)">
            <span class="positive" style="font-size:0.85rem">Buy: ${summary.buySignals}</span>
            &nbsp;|&nbsp;
            <span class="negative" style="font-size:0.85rem">Sell: ${summary.sellSignals}</span>
          </div>
          <div style="margin-top:var(--space-sm);">
            <div style="width:100%;height:8px;background:var(--red);border-radius:4px;overflow:hidden">
              <div style="width:${Math.max(0, 50 + summary.score / 2)}%;height:100%;background:var(--green);transition:width 0.5s"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-muted);margin-top:2px">
              <span>Sell</span><span>Neutral</span><span>Buy</span>
            </div>
          </div>
        </div>

        ${summary.details.map(d => `
          <div class="indicator-row">
            <span class="indicator-name">${d.name}</span>
            <span class="indicator-value ${d.signal === 'BUY' ? 'positive' : d.signal === 'SELL' ? 'negative' : ''}">${d.value}</span>
            <span class="signal-badge signal-${d.signal.toLowerCase()}" style="font-size:0.6rem">${d.desc}</span>
          </div>
        `).join('')}
      </div>

      <!-- Indicator Values -->
      <div class="card">
        <div class="card-title">📏 Nilai Indikator</div>
        
        <div class="indicator-row">
          <span class="indicator-name">RSI (14)</span>
          <span class="indicator-value ${getColorClass(ind.rsi[last], 30, 70)}">${ind.rsi[last]?.toFixed(1) ?? 'N/A'}</span>
        </div>
        <div class="indicator-row">
          <span class="indicator-name">MACD</span>
          <span class="indicator-value ${ind.macd.macd[last] > 0 ? 'positive' : 'negative'}">${ind.macd.macd[last]?.toFixed(2) ?? 'N/A'}</span>
        </div>
        <div class="indicator-row">
          <span class="indicator-name">MACD Signal</span>
          <span class="indicator-value">${ind.macd.signal[last]?.toFixed(2) ?? 'N/A'}</span>
        </div>
        <div class="indicator-row">
          <span class="indicator-name">MACD Histogram</span>
          <span class="indicator-value ${(ind.macd.histogram[last] ?? 0) > 0 ? 'positive' : 'negative'}">${ind.macd.histogram[last]?.toFixed(2) ?? 'N/A'}</span>
        </div>
        <div class="indicator-row">
          <span class="indicator-name">Stochastic %K</span>
          <span class="indicator-value">${ind.stoch.k[last]?.toFixed(1) ?? 'N/A'}</span>
        </div>
        <div class="indicator-row">
          <span class="indicator-name">Stochastic %D</span>
          <span class="indicator-value">${ind.stoch.d[last]?.toFixed(1) ?? 'N/A'}</span>
        </div>
        <div class="indicator-row">
          <span class="indicator-name">ADX</span>
          <span class="indicator-value">${ind.adx.adx[last]?.toFixed(1) ?? 'N/A'}</span>
        </div>
        <div class="indicator-row">
          <span class="indicator-name">MFI (14)</span>
          <span class="indicator-value ${getColorClass(ind.mfi[last], 20, 80)}">${ind.mfi[last]?.toFixed(1) ?? 'N/A'}</span>
        </div>

        <div style="margin-top:var(--space-lg)">
          <div class="card-title">📐 Moving Averages</div>
          ${['sma5', 'sma10', 'sma20', 'sma50', 'sma200'].map(key => {
    const val = ind.sma[key]?.[last];
    const price = data[last].close;
    return `
              <div class="indicator-row">
                <span class="indicator-name">${key.toUpperCase()}</span>
                <span class="indicator-value">${val?.toFixed(0) ?? 'N/A'}</span>
                <span class="signal-badge ${val && price > val ? 'signal-buy' : val ? 'signal-sell' : 'signal-neutral'}" style="font-size:0.6rem">
                  ${val && price > val ? 'Di atas' : val ? 'Di bawah' : 'N/A'}
                </span>
              </div>
            `;
  }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ── Entry Point Tab ────────────────────────────────────────

function renderEntryTab(container) {
  const ep = state.entryPoint;
  if (!ep) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎯</div>Memuat data entry point...</div>';
    return;
  }

  container.innerHTML = `
    <div class="grid-2 animate-in">
      <div class="card">
        <div class="card-title">🎯 Titik Entry</div>
        <div style="text-align:center;margin-bottom:var(--space-lg)">
          <span class="signal-badge ${ep.recommendation.includes('ENTRY') ? 'signal-buy' : ep.recommendation.includes('AVOID') ? 'signal-sell' : 'signal-neutral'}" style="font-size:1.1rem;padding:var(--space-md) var(--space-xl)">
            ${ep.recommendation}
          </span>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:var(--space-md)">
            ${ep.entryReason}
          </div>
        </div>

        <div class="entry-price-row entry-buy">
          <div>
            <div class="entry-label">Harga Entry</div>
            <div class="entry-value positive">${formatIDR(ep.entryPrice)}</div>
          </div>
          <div style="text-align:right">
            <div class="entry-label">Harga Saat Ini</div>
            <div class="entry-value">${formatIDR(ep.currentPrice)}</div>
          </div>
        </div>

        <div class="entry-price-row entry-stop">
          <div>
            <div class="entry-label">Stop Loss</div>
            <div class="entry-value negative">${formatIDR(ep.stopLoss)}</div>
          </div>
          <div style="text-align:right">
            <div class="entry-percent negative">-${ep.stopLossPercent}%</div>
          </div>
        </div>

        <div class="entry-price-row entry-target">
          <div>
            <div class="entry-label">Target 1</div>
            <div class="entry-value" style="color:var(--accent-blue)">${formatIDR(ep.target1)}</div>
          </div>
          <div style="text-align:right">
            <div class="entry-percent positive">+${ep.target1Percent}%</div>
          </div>
        </div>

        <div class="entry-price-row entry-target">
          <div>
            <div class="entry-label">Target 2</div>
            <div class="entry-value" style="color:var(--accent-purple)">${formatIDR(ep.target2)}</div>
          </div>
          <div style="text-align:right">
            <div class="entry-percent positive">+${ep.target2Percent}%</div>
          </div>
        </div>

        <div style="margin-top:var(--space-lg);padding:var(--space-md);background:rgba(59,130,246,0.1);border-radius:var(--radius-sm);text-align:center">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Risk/Reward Ratio</div>
          <div style="font-size:1.8rem;font-weight:800;font-family:var(--font-mono);color:var(--accent-cyan)">1:${ep.riskReward}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📐 Support & Resistance</div>
        
        <div style="position:relative;padding:var(--space-lg) 0">
          ${renderSRLevels(ep)}
        </div>

        ${ep.pivots ? `
          <div style="margin-top:var(--space-lg)">
            <div class="card-title">🔄 Pivot Points</div>
            <div class="indicator-row">
              <span class="indicator-name">R3</span>
              <span class="indicator-value positive">${formatIDR(ep.pivots.r3)}</span>
            </div>
            <div class="indicator-row">
              <span class="indicator-name">R2</span>
              <span class="indicator-value positive">${formatIDR(ep.pivots.r2)}</span>
            </div>
            <div class="indicator-row">
              <span class="indicator-name">R1</span>
              <span class="indicator-value positive">${formatIDR(ep.pivots.r1)}</span>
            </div>
            <div class="indicator-row" style="background:rgba(59,130,246,0.1);border-radius:var(--radius-sm);padding:var(--space-sm) var(--space-md)">
              <span class="indicator-name" style="font-weight:700;color:var(--accent-blue)">Pivot</span>
              <span class="indicator-value" style="color:var(--accent-blue)">${formatIDR(ep.pivots.pp)}</span>
            </div>
            <div class="indicator-row">
              <span class="indicator-name">S1</span>
              <span class="indicator-value negative">${formatIDR(ep.pivots.s1)}</span>
            </div>
            <div class="indicator-row">
              <span class="indicator-name">S2</span>
              <span class="indicator-value negative">${formatIDR(ep.pivots.s2)}</span>
            </div>
            <div class="indicator-row">
              <span class="indicator-name">S3</span>
              <span class="indicator-value negative">${formatIDR(ep.pivots.s3)}</span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderSRLevels(ep) {
  const levels = [
    { label: 'Resistance 2', value: ep.resistance2, type: 'negative' },
    { label: 'Resistance 1', value: ep.resistance, type: 'negative' },
    { label: 'Target 1', value: ep.target1, type: 'positive' },
    { label: 'Harga Entry', value: ep.entryPrice, type: 'accent' },
    { label: 'Harga Saat Ini', value: ep.currentPrice, type: 'current' },
    { label: 'Support 1', value: ep.support, type: 'positive' },
    { label: 'Stop Loss', value: ep.stopLoss, type: 'negative' },
    { label: 'Support 2', value: ep.support2, type: 'positive' },
  ].sort((a, b) => b.value - a.value);

  return levels.map(l => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) var(--space-md);margin-bottom:4px;border-radius:var(--radius-sm);
      ${l.type === 'current' ? 'background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3)' :
      l.type === 'accent' ? 'background:rgba(16,185,129,0.1)' : ''}">
      <span style="font-size:0.8rem;${l.type === 'current' ? 'font-weight:700;color:var(--accent-blue)' : 'color:var(--text-secondary)'}">${l.label}</span>
      <span style="font-family:var(--font-mono);font-weight:600;font-size:0.85rem;
        ${l.type === 'negative' ? 'color:var(--red)' : l.type === 'positive' ? 'color:var(--green)' : l.type === 'current' ? 'color:var(--accent-blue)' : 'color:var(--accent-cyan)'}">
        ${formatIDR(l.value)}
      </span>
    </div>
  `).join('');
}

// ── Money Flow Tab ─────────────────────────────────────────

function renderMoneyFlowTab(container) {
  if (!state.indicators || !state.bandar || !state.chartData) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div>Memuat data money flow...</div>';
    return;
  }

  const data = state.chartData.data;
  const last = data.length - 1;
  const ind = state.indicators;
  const bandar = state.bandar;

  const mfiVal = ind.mfi[last];
  const obvVal = ind.obv[last];
  const vwapVal = ind.vwap[last];

  container.innerHTML = `
    <div class="grid-4 animate-in" style="margin-bottom:var(--space-lg)">
      <div class="stat-card">
        <div class="stat-value ${getColorClass(mfiVal, 20, 80)}">${mfiVal?.toFixed(1) ?? 'N/A'}</div>
        <div class="stat-label">MFI (14)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatVolume(Math.abs(obvVal || 0))}</div>
        <div class="stat-label">OBV</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatIDR(vwapVal || 0)}</div>
        <div class="stat-label">VWAP</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatVolume(data[last].volume)}</div>
        <div class="stat-label">Volume</div>
      </div>
    </div>

    <div class="grid-2 animate-in">
      <div class="card">
        <div class="card-title">💰 Money Flow Index</div>
        <div style="text-align:center;margin-bottom:var(--space-lg)">
          <div style="font-size:3rem;font-weight:800;font-family:var(--font-mono);${getColorStyle(mfiVal, 20, 80)}">${mfiVal?.toFixed(1) ?? 'N/A'}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary)">
            ${mfiVal < 20 ? '🟢 Oversold — Potensi reversal naik' : mfiVal > 80 ? '🔴 Overbought — Potensi koreksi' : '🟡 Area netral'}
          </div>
        </div>
        <div style="width:100%;height:12px;background:rgba(55,65,81,0.5);border-radius:6px;position:relative;overflow:hidden">
          <div style="position:absolute;left:0;top:0;height:100%;width:20%;background:rgba(16,185,129,0.3)"></div>
          <div style="position:absolute;right:0;top:0;height:100%;width:20%;background:rgba(239,68,68,0.3)"></div>
          <div style="position:absolute;top:-2px;height:16px;width:4px;background:white;border-radius:2px;left:${mfiVal || 50}%;transition:left 0.5s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-muted);margin-top:4px">
          <span>Oversold (20)</span><span>Overbought (80)</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🌐 Estimasi Aliran Dana</div>
        <div style="margin-bottom:var(--space-md)">
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm)">
            <span style="font-size:0.8rem;color:var(--green)">📥 Inflow: ${bandar.inflowDays} hari</span>
            <span style="font-size:0.8rem;color:var(--red)">📤 Outflow: ${bandar.outflowDays} hari</span>
          </div>
          <div class="flow-bar">
            <div class="flow-bar-in" style="width:${bandar.inflowDays * 10}%">${bandar.inflowDays * 10}%</div>
            <div class="flow-bar-out" style="width:${bandar.outflowDays * 10}%">${bandar.outflowDays * 10}%</div>
          </div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:var(--space-sm)">
            <em>*Berdasarkan analisis price-volume 10 hari terakhir</em>
          </div>
        </div>

        <div style="margin-top:var(--space-lg)">
          <div class="card-title">📊 Price vs VWAP</div>
          <div class="indicator-row">
            <span class="indicator-name">Harga</span>
            <span class="indicator-value">${formatIDR(data[last].close)}</span>
          </div>
          <div class="indicator-row">
            <span class="indicator-name">VWAP</span>
            <span class="indicator-value">${formatIDR(vwapVal || 0)}</span>
          </div>
          <div class="indicator-row">
            <span class="indicator-name">Posisi</span>
            <span class="indicator-value ${data[last].close > vwapVal ? 'positive' : 'negative'}">
              ${data[last].close > vwapVal ? '▲ Di atas VWAP' : '▼ Di bawah VWAP'}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Bandarmology Tab ───────────────────────────────────────

function renderBandarTab(container) {
  if (!state.bandar) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏦</div>Memuat data bandarmology...</div>';
    return;
  }

  const b = state.bandar;
  const phaseClass = b.overallPhase.includes('ACCUMULATION') ? 'phase-accumulation' :
    b.overallPhase.includes('DISTRIBUTION') ? 'phase-distribution' : 'phase-neutral';
  const phaseLabel = b.overallPhase.replace('EARLY_', 'Awal ').replace('ACCUMULATION', 'Akumulasi').replace('DISTRIBUTION', 'Distribusi').replace('NEUTRAL', 'Netral');

  container.innerHTML = `
    <div class="grid-2 animate-in">
      <div class="card">
        <div class="card-title">🏦 Bandarmology Meter</div>
        <div style="text-align:center;margin-bottom:var(--space-xl)">
          <span class="phase-badge ${phaseClass}" style="font-size:0.9rem;padding:var(--space-sm) var(--space-xl)">${phaseLabel}</span>
        </div>

        <div style="margin-bottom:var(--space-xl)">
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm)">
            <span style="font-size:0.75rem;color:var(--text-muted)">Distribusi</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">Netral</span>
            <span style="font-size:0.75rem;color:var(--text-muted)">Akumulasi</span>
          </div>
          <div class="bandar-meter-bar">
            <div class="bandar-meter-indicator" style="left:calc(${b.bandarMeter}% - 10px)"></div>
          </div>
          <div style="text-align:center;font-size:2rem;font-weight:800;font-family:var(--font-mono);margin-top:var(--space-md);
            ${b.bandarMeter > 60 ? 'color:var(--green)' : b.bandarMeter < 40 ? 'color:var(--red)' : 'color:var(--yellow)'}">
            ${b.bandarMeter}
          </div>
        </div>

        <div class="grid-2" style="gap:var(--space-md)">
          <div class="stat-card">
            <div class="stat-value positive">${b.smartBuys}</div>
            <div class="stat-label">Smart Buy</div>
          </div>
          <div class="stat-card">
            <div class="stat-value negative">${b.smartSells}</div>
            <div class="stat-label">Smart Sell</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--accent-cyan)">${b.breakouts}</div>
            <div class="stat-label">Breakout</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--orange)">${b.unusualVolumeCount}</div>
            <div class="stat-label">Unusual Vol</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🔔 Sinyal Terbaru</div>
        ${b.recentSignals.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:var(--space-xl)">Tidak ada sinyal signifikan</div>' : ''}
        ${b.recentSignals.map(s => {
    const signalClass = s.signal === 'SMART_BUY' ? 'smart-buy' :
      s.signal === 'SMART_SELL' ? 'smart-sell' :
        s.signal === 'BREAKOUT' ? 'breakout' : 'quiet-acc';
    const signalColor = s.signal === 'SMART_BUY' ? 'var(--green)' :
      s.signal === 'SMART_SELL' ? 'var(--red)' :
        s.signal === 'BREAKOUT' ? 'var(--accent-cyan)' : 'var(--accent-purple)';
    return `
            <div class="signal-item ${signalClass}">
              <div class="signal-item-header">
                <span class="signal-item-date">${s.date}</span>
                <span class="signal-item-type" style="color:${signalColor}">${s.signal.replace('_', ' ')}</span>
              </div>
              <div class="signal-item-desc">${s.description}</div>
              <div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px">
                Price Δ: ${s.priceChange}% | Vol Δ: ${s.volChange}%
              </div>
            </div>
          `;
  }).join('')}

        ${b.unusualVolDays.length > 0 ? `
          <div style="margin-top:var(--space-lg)">
            <div class="card-title">🔥 Unusual Volume</div>
            ${b.unusualVolDays.map(v => `
              <div class="indicator-row">
                <span class="indicator-name">${v.date}</span>
                <span class="indicator-value" style="color:var(--orange)">${formatVolume(v.volume)} (${v.ratio.toFixed(1)}x avg)</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ── Screener Tab ───────────────────────────────────────────

// ── EOD Prediction Tab ─────────────────────────────────────

function renderEODTab(container) {
  const eod = state.eodData;
  if (!eod) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔮</div>Memuat analisa EOD...</div>';
    return;
  }

  const pred = eod.prediction;
  const biasColor = pred.bias.includes('bullish') ? 'var(--green)' : pred.bias.includes('bearish') ? 'var(--red)' : 'var(--accent-blue)';
  const biasIcon = pred.bias.includes('bullish') ? '📈' : pred.bias.includes('bearish') ? '📉' : '➡️';

  container.innerHTML = `
    <div class="animate-in">
      <!-- Prediction Hero -->
      <div class="card" style="text-align:center;border:1px solid ${biasColor}33">
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:2px;color:var(--text-muted);margin-bottom:var(--space-sm)">Prediksi Besok • ${eod.date || 'Hari Ini'}</div>
        <div style="font-size:3rem;font-weight:900;margin:var(--space-md) 0;color:${biasColor}">
          ${biasIcon} ${pred.prediction}
        </div>
        <div style="display:flex;justify-content:center;gap:var(--space-xl);margin:var(--space-lg) 0">
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted)">Skor Bullish</div>
            <div style="font-size:1.5rem;font-weight:700;color:var(--green)">${pred.bullishScore}</div>
          </div>
          <div style="width:1px;background:var(--border)"></div>
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted)">Skor Bearish</div>
            <div style="font-size:1.5rem;font-weight:700;color:var(--red)">${pred.bearishScore}</div>
          </div>
          <div style="width:1px;background:var(--border)"></div>
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted)">Confidence</div>
            <div style="font-size:1.5rem;font-weight:700;color:var(--accent-cyan)">${pred.confidence}%</div>
          </div>
        </div>

        <!-- Bullish/Bearish Gauge -->
        <div style="width:100%;height:14px;background:rgba(239,68,68,0.3);border-radius:7px;overflow:hidden;position:relative">
          <div style="height:100%;width:${pred.bullishPct}%;background:linear-gradient(90deg,var(--green),#34d399);border-radius:7px;transition:width 0.8s ease"></div>
          <div style="position:absolute;top:-1px;left:50%;width:2px;height:16px;background:white;opacity:0.5"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-muted);margin-top:4px">
          <span>🐻 Bearish</span><span>📊 ${pred.bullishPct}% Bullish</span><span>🐂 Bullish</span>
        </div>
      </div>

      <div class="grid-2" style="margin-top:var(--space-lg)">
        <!-- Estimated Tomorrow Price Range -->
        <div class="card">
          <div class="card-title">📐 Estimasi Range Besok</div>
          <div style="text-align:center;margin:var(--space-lg) 0">
            <div class="indicator-row" style="padding:var(--space-md)">
              <span class="indicator-name" style="color:var(--green)">▲ Estimasi High</span>
              <span class="indicator-value positive" style="font-size:1.1rem">${formatIDR(pred.expectedHigh)}</span>
            </div>
            <div class="indicator-row" style="padding:var(--space-md);background:rgba(59,130,246,0.1);border-radius:var(--radius-sm)">
              <span class="indicator-name" style="font-weight:700;color:var(--accent-blue)">Close Hari Ini</span>
              <span class="indicator-value" style="font-size:1.1rem;color:var(--accent-blue)">${formatIDR(pred.lastClose)}</span>
            </div>
            <div class="indicator-row" style="padding:var(--space-md)">
              <span class="indicator-name" style="color:var(--red)">▼ Estimasi Low</span>
              <span class="indicator-value negative" style="font-size:1.1rem">${formatIDR(pred.expectedLow)}</span>
            </div>
            <div style="margin-top:var(--space-lg);padding:var(--space-md);background:rgba(55,65,81,0.3);border-radius:var(--radius-sm)">
              <div style="font-size:0.7rem;color:var(--text-muted)">ATR (Avg True Range)</div>
              <div style="font-size:1.3rem;font-weight:700;font-family:var(--font-mono);color:var(--accent-cyan)">${formatIDR(pred.expectedRange)}</div>
            </div>
          </div>
        </div>

        <!-- Candlestick Patterns -->
        <div class="card">
          <div class="card-title">🕯️ Pola Candlestick Terdeteksi</div>
          ${eod.candlePatterns.length === 0
      ? '<div style="text-align:center;color:var(--text-muted);padding:var(--space-lg)">Tidak ada pola signifikan terdeteksi hari ini</div>'
      : eod.candlePatterns.map(pat => `
              <div style="padding:var(--space-md);margin-bottom:var(--space-sm);border-radius:var(--radius-sm);background:${pat.type === 'bullish' ? 'rgba(16,185,129,0.08)' : pat.type === 'bearish' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)'};border-left:3px solid ${pat.type === 'bullish' ? 'var(--green)' : pat.type === 'bearish' ? 'var(--red)' : 'var(--accent-blue)'}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <span style="font-weight:700;font-size:0.85rem">${pat.name}</span>
                  <span class="signal-badge signal-${pat.type === 'bullish' ? 'buy' : pat.type === 'bearish' ? 'sell' : 'neutral'}" style="font-size:0.6rem">${pat.type === 'bullish' ? 'BULLISH' : pat.type === 'bearish' ? 'BEARISH' : 'NETRAL'}</span>
                </div>
                <div style="font-size:0.75rem;color:var(--text-secondary)">${pat.desc}</div>
                <div style="margin-top:4px">
                  <div style="width:100%;height:4px;background:rgba(55,65,81,0.3);border-radius:2px;overflow:hidden">
                    <div style="height:100%;width:${pat.strength * 10}%;background:${pat.type === 'bullish' ? 'var(--green)' : pat.type === 'bearish' ? 'var(--red)' : 'var(--accent-blue)'};border-radius:2px"></div>
                  </div>
                  <div style="font-size:0.6rem;color:var(--text-muted);text-align:right;margin-top:2px">Kekuatan: ${pat.strength}/10</div>
                </div>
              </div>
            `).join('')
    }
        </div>
      </div>

      <!-- Volume Profile -->
      ${eod.volumeProfile ? `
        <div class="grid-4" style="margin-top:var(--space-lg)">
          <div class="stat-card">
            <div class="stat-value">${formatVolume(eod.volumeProfile.todayVolume)}</div>
            <div class="stat-label">Volume Hari Ini</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${eod.volumeProfile.volumeRatio.toFixed(1)}x</div>
            <div class="stat-label">vs Rata-rata</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:${eod.volumeProfile.volumeTrend === 'MENINGKAT' ? 'var(--green)' : eod.volumeProfile.volumeTrend === 'MENURUN' ? 'var(--red)' : 'var(--text-primary)'}">${eod.volumeProfile.volumeTrend}</div>
            <div class="stat-label">Tren Volume</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:${eod.volumeProfile.priceVolumeCorrelation === 'SELARAS' ? 'var(--green)' : 'var(--yellow)'}">${eod.volumeProfile.priceVolumeCorrelation}</div>
            <div class="stat-label">Price-Vol</div>
          </div>
        </div>
      ` : ''}

      <!-- Prediction Factors -->
      <div class="card" style="margin-top:var(--space-lg)">
        <div class="card-title">📊 Faktor Analisis Detail</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:var(--space-md)">Setiap faktor memberikan skor bullish/bearish yang menentukan prediksi besok</div>
        ${pred.factors.map(f => `
          <div class="indicator-row">
            <span class="indicator-name">${f.factor}</span>
            <div style="display:flex;align-items:center;gap:var(--space-sm)">
              <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-muted)">+${f.weight}</span>
              <span class="signal-badge signal-${f.bias === 'bullish' ? 'buy' : f.bias === 'bearish' ? 'sell' : f.bias === 'warning' ? 'neutral' : 'neutral'}" style="font-size:0.6rem;min-width:60px;text-align:center">
                ${f.bias === 'bullish' ? '🐂 BULL' : f.bias === 'bearish' ? '🐻 BEAR' : '⚠️ WARNING'}
              </span>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="text-align:center;padding:var(--space-lg);font-size:0.7rem;color:var(--text-muted)">
        ⚠️ Prediksi berdasarkan analisa teknikal EOD — bukan financial advice. Selalu gunakan manajemen risiko.
      </div>
    </div>
  `;
}

// ── Screener Tab ───────────────────────────────────────────

function renderScreenerTab(container) {
  const stocks = state.screenedStocks;

  container.innerHTML = `
    <div class="card animate-in">
      <div class="card-title">📋 Hasil Screening — ${stocks.length} saham</div>
      ${stocks.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div>Klik "Jalankan Screener" di sidebar untuk memulai screening</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:var(--space-sm)">Proses ini akan menganalisis ${IDX_STOCKS.length} saham IDX</div>
        </div>
      ` : `
        <div style="overflow-x:auto">
          <table class="screener-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Harga</th>
                <th>Perubahan</th>
                <th>Volume</th>
                <th>RSI</th>
                <th>Sinyal</th>
                <th>Fase Bandar</th>
                <th>Entry</th>
              </tr>
            </thead>
            <tbody>
              ${stocks.map(s => {
    const rsi = s.indicators.rsi[s.data.length - 1];
    const signal = s.techSummary.signal;
    const phase = s.bandar?.overallPhase?.replace('EARLY_', '').replace('ACCUMULATION', 'Akum').replace('DISTRIBUTION', 'Dist').replace('NEUTRAL', 'Netral') || 'N/A';
    const phaseClass = s.bandar?.overallPhase?.includes('ACCUMULATION') ? 'positive' : s.bandar?.overallPhase?.includes('DISTRIBUTION') ? 'negative' : '';
    return `
                  <tr data-symbol="${s.symbol}">
                    <td><strong style="font-family:var(--font-mono);color:var(--accent-cyan)">${s.symbol.replace('.JK', '')}</strong></td>
                    <td style="font-family:var(--font-mono)">${formatIDR(s.lastPrice)}</td>
                    <td class="${s.change >= 0 ? 'positive' : 'negative'}" style="font-family:var(--font-mono)">${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%</td>
                    <td style="font-family:var(--font-mono)">${formatVolume(s.volume)}</td>
                    <td class="${getColorClass(rsi, 30, 70)}" style="font-family:var(--font-mono)">${rsi?.toFixed(1) ?? 'N/A'}</td>
                    <td><span class="signal-badge signal-${signal.toLowerCase().replace(' ', '-')}" style="font-size:0.6rem">${signal}</span></td>
                    <td class="${phaseClass}">${phase}</td>
                    <td><span class="signal-badge ${s.entryPoint?.recommendation?.includes('ENTRY') ? 'signal-buy' : 'signal-neutral'}" style="font-size:0.6rem">${s.entryPoint?.recommendation || 'N/A'}</span></td>
                  </tr>
                `;
  }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// ── Load Screener Data ─────────────────────────────────────

async function loadScreenerData() {
  const btn = document.getElementById('btn-screen');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Screening...';
  }

  const filters = {
    signal: document.getElementById('filter-signal')?.value || '',
    rsiBelow: parseFloat(document.getElementById('filter-rsi')?.value) || null,
    bandarPhase: document.getElementById('filter-bandar')?.value || '',
    entryOnly: document.getElementById('filter-entry-only')?.checked || false,
  };

  const sectorFilter = document.getElementById('filter-sector')?.value || '';
  let stockList = IDX_STOCKS;
  if (sectorFilter) {
    stockList = IDX_STOCKS.filter(s => s.sector === sectorFilter);
  }

  const results = [];
  let processed = 0;

  for (const stock of stockList) {
    try {
      const chartResult = await fetchChartData(stock.symbol, '6mo');
      if (chartResult) {
        const screened = screenStock(chartResult);
        if (screened) results.push(screened);
      }
    } catch (e) {
      console.warn(`Skipped ${stock.symbol}:`, e);
    }
    processed++;

    if (btn) btn.innerHTML = `⏳ ${processed}/${stockList.length}`;
  }

  // Apply filters
  state.screenedStocks = filterStocks(results, filters);

  // Sort by signal strength
  state.screenedStocks.sort((a, b) => b.techSummary.score - a.techSummary.score);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '🔍 Jalankan Screener';
  }

  if (state.activeTab === 'screener') {
    renderTabContent('screener');
  }
}

// ── Search Rendering ──────────────────────────────────────

function renderSearchResults(results, container) {
  container.innerHTML = results.map(s => `
    <div class="search-item" data-symbol="${s.symbol}">
      <div>
        <div class="search-item-symbol">${s.symbol.replace('.JK', '')}</div>
        <div class="search-item-name">${s.name}</div>
      </div>
      <div style="font-size:0.7rem;color:var(--text-muted)">${s.sector || ''}</div>
    </div>
  `).join('');
}

// ── Events ─────────────────────────────────────────────────

function bindEvents() {
  // Search
  const searchInput = document.getElementById('search-input');
  const searchDropdown = document.getElementById('search-dropdown');

  let searchTimeout = null;
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length < 1) {
      searchDropdown.classList.remove('active');
      return;
    }

    // Show immediate local results
    const localMatches = IDX_STOCKS.filter(s =>
      s.symbol.toUpperCase().includes(query.toUpperCase()) ||
      s.name.toUpperCase().includes(query.toUpperCase())
    ).slice(0, 5);

    if (localMatches.length) {
      renderSearchResults(localMatches, searchDropdown);
      searchDropdown.classList.add('active');
    }

    // Debounced backend search for more results
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const results = await searchStocks(query);
      if (results.length && searchInput.value.trim()) {
        renderSearchResults(results, searchDropdown);
        searchDropdown.classList.add('active');
      }
    }, 300);
  });

  searchInput?.addEventListener('blur', () => {
    setTimeout(() => searchDropdown?.classList.remove('active'), 200);
  });

  // Search item click
  document.addEventListener('click', (e) => {
    const searchItem = e.target.closest('.search-item');
    if (searchItem) {
      const symbol = searchItem.dataset.symbol;
      loadStockData(symbol);
      searchInput.value = '';
      searchDropdown.classList.remove('active');
    }

    // Watchlist item click
    const watchlistItem = e.target.closest('.watchlist-item');
    if (watchlistItem) {
      const symbol = watchlistItem.dataset.symbol;
      loadStockData(symbol);
    }

    // Chart range
    const rangeBtn = e.target.closest('.chart-range-btn');
    if (rangeBtn) {
      document.querySelectorAll('.chart-range-btn').forEach(b => b.classList.remove('active'));
      rangeBtn.classList.add('active');
      state.chartRange = rangeBtn.dataset.range;
      loadStockData(state.selectedSymbol);
    }

    // Tabs
    const tabBtn = e.target.closest('.tab-btn');
    if (tabBtn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      renderTabContent(tabBtn.dataset.tab);
    }

    // Screener table row
    const tableRow = e.target.closest('.screener-table tbody tr');
    if (tableRow) {
      const symbol = tableRow.dataset.symbol;
      if (symbol) loadStockData(symbol);
    }
  });

  // Refresh
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    loadStockData(state.selectedSymbol);
  });

  // Screen button
  document.getElementById('btn-screen')?.addEventListener('click', () => {
    loadScreenerData();
  });
}

// ── Helpers ────────────────────────────────────────────────

function updateWatchlistActive(symbol) {
  document.querySelectorAll('.watchlist-item').forEach(el => {
    el.classList.toggle('active', el.dataset.symbol === symbol);
  });
}

function getColorClass(value, low, high) {
  if (value === null || value === undefined) return '';
  if (value < low) return 'positive'; // oversold = good for buy
  if (value > high) return 'negative'; // overbought
  return '';
}

function getColorStyle(value, low, high) {
  if (value === null || value === undefined) return '';
  if (value < low) return 'color:var(--green)';
  if (value > high) return 'color:var(--red)';
  return 'color:var(--yellow)';
}

// ── Start ──────────────────────────────────────────────────
init();
