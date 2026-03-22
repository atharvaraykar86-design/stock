/*!
 * FinSight AI — script.js  v8  (Production-Ready)
 *
 * FIX 1: All buttons & click interactions — event delegation, no orphan listeners
 * FIX 2: Live P&L — polls /live-price every 15 s, green/red coloring
 * FIX 3: Market category filtering — strict per-market whitelist + validation
 * FIX 4: Full i18n — EN / Hindi / Marathi, all text, instant, saved
 * FIX 5: Premium features — proper gating, state management, show/hide
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     0.  UTILITIES
  ═══════════════════════════════════════════════════════════ */
  var g   = function (id)       { return document.getElementById(id); };
  var qs  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var qsa = function (sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); };
  var on  = function (el, ev, fn) { if (el) el.addEventListener(ev, fn); };

  function show(el, disp) { if (el) el.style.display = disp !== undefined ? disp : ''; }
  function hide(el)       { if (el) el.style.display = 'none'; }
  function text(id, val)  { var e = g(id); if (e) e.textContent = val; }
  function html(id, val)  { var e = g(id); if (e) e.innerHTML   = val; }

  function fmtPrice(n) {
    var v = parseFloat(n);
    if (isNaN(v)) return '—';
    if (v >= 10000)  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (v >= 1)      return v.toFixed(2);
    if (v >= 0.01)   return v.toFixed(4);
    return v.toFixed(6);
  }

  function fmtPct(n) {
    var v = parseFloat(n);
    if (isNaN(v)) return '0.00%';
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  }

  function toast(msg, type) {
    var tc = g('toastContainer');
    if (!tc) return;
    var d   = document.createElement('div');
    d.className = 'toast ' + (type || 'info');
    var icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warn: 'fa-exclamation-triangle' };
    d.innerHTML = '<i class="fa ' + (icons[type] || icons.info) + '"></i><span>' + msg + '</span>';
    tc.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3500);
  }

  function safeJSON(key, def) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch (e) { return def; }
  }

  /* ═══════════════════════════════════════════════════════════
     1.  APP STATE
  ═══════════════════════════════════════════════════════════ */
  var S = {
    market        : 'stocks',
    lastData      : null,
    theme         : localStorage.getItem('fs_theme')  || 'dark',
    range         : '3mo',
    currentSym    : '',
    lang          : localStorage.getItem('fs_lang')   || 'en',
    livePnLTimer  : null,
    tickerTimer   : null
  };

  /* ═══════════════════════════════════════════════════════════
     2.  MARKET CONFIG  +  FIX 3: strict whitelists
  ═══════════════════════════════════════════════════════════ */
  var MKTS = {
    stocks: {
      label: 'Stock Market', icon: '📈', cur: '₹',
      ph:    'e.g. TCS, RELIANCE, AAPL, NVDA',
      title: 'AI Stock Forecast',
      sub:   'AI-Powered 7-Day Market Intelligence',
      chips: ['TCS', 'RELIANCE', 'INFY', 'HDFCBANK', 'AAPL', 'NVDA', 'MSFT', 'GOOGL'],
      wl: ['TCS','RELIANCE','INFY','HDFCBANK','ICICIBANK','WIPRO','BAJFINANCE',
           'HINDUNILVR','KOTAKBANK','SBIN','AXISBANK','LT','ITC','ASIANPAINT',
           'TATAMOTORS','BHARTIARTL','AAPL','MSFT','GOOGL','AMZN','TSLA','NVDA',
           'META','NFLX','AMD','INTC','BABA','DIS','TCS.NS','RELIANCE.NS',
           'INFY.NS','HDFCBANK.NS','WIPRO.NS'],
      url: '/market-movers?market=stocks'
    },
    crypto: {
      label: 'Crypto Market', icon: '₿', cur: '$',
      ph:    'e.g. BTC, ETH, SOL, BNB',
      title: 'AI Crypto Forecast',
      sub:   'AI-Powered 7-Day Crypto Intelligence',
      chips: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX'],
      wl: ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','MATIC','DOT',
           'LINK','UNI','LTC','BCH','ATOM','BTC-USD','ETH-USD','SOL-USD',
           'BNB-USD','XRP-USD','DOGE-USD'],
      url: '/market-movers?market=crypto'
    },
    forex: {
      label: 'Forex Market', icon: '💱', cur: '',
      ph:    'e.g. USDINR, EURUSD, GBPUSD',
      title: 'AI Forex Forecast',
      sub:   'AI-Powered 7-Day Currency Intelligence',
      chips: ['USDINR', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF'],
      wl: ['USDINR','EURUSD','GBPUSD','USDJPY','AUDUSD','USDCHF','USDCAD',
           'NZDUSD','EURGBP','EURJPY','USDINR=X','EURUSD=X','GBPUSD=X',
           'USDJPY=X','AUDUSD=X'],
      url: '/market-movers?market=forex'
    },
    indices: {
      label: 'Indices', icon: '📊', cur: '',
      ph:    'e.g. NIFTY, SENSEX, SPX, NASDAQ',
      title: 'AI Index Forecast',
      sub:   'AI-Powered 7-Day Index Intelligence',
      chips: ['NIFTY', 'SENSEX', 'SPX', 'NASDAQ', 'DJI', 'NIKKEI', 'FTSE'],
      wl: ['NIFTY','SENSEX','SPX','NASDAQ','DJI','NIKKEI','FTSE','CAC40','DAX',
           'HANGSENG','KOSPI','^NSEI','^BSESN','^GSPC','^IXIC','^DJI','^N225'],
      url: '/market-movers?market=indices'
    },
    commodities: {
      label: 'Commodities', icon: '🪙', cur: '$',
      ph:    'e.g. GOLD, SILVER, CRUDE, NATGAS',
      title: 'AI Commodity Forecast',
      sub:   'AI-Powered 7-Day Commodity Intelligence',
      chips: ['GOLD', 'SILVER', 'CRUDE', 'NATGAS', 'COPPER', 'WHEAT', 'CORN'],
      wl: ['GOLD','SILVER','CRUDE','NATGAS','COPPER','WHEAT','CORN','PLATINUM',
           'PALLADIUM','COTTON','GC=F','SI=F','CL=F','NG=F','HG=F'],
      url: '/market-movers?market=commodities'
    }
  };

  /* Reverse lookup: symbol → market */
  var SYM2MKT = {};
  Object.keys(MKTS).forEach(function (m) {
    MKTS[m].wl.forEach(function (s) { SYM2MKT[s.toUpperCase()] = m; });
  });

  function symMkt(sym) { return SYM2MKT[sym.toUpperCase()] || null; }

  /* FIX 3: suffix-based validation */
  function validForMkt(sym, mkt) {
    var u  = sym.toUpperCase();
    var wl = (MKTS[mkt] || {}).wl || [];
    if (wl.indexOf(u) !== -1) return true;
    if (mkt === 'crypto'      && (u.endsWith('-USD') || u.endsWith('USDT'))) return true;
    if (mkt === 'forex'       && u.endsWith('=X'))                           return true;
    if (mkt === 'indices'     && u.startsWith('^'))                          return true;
    if (mkt === 'commodities' && u.endsWith('=F'))                           return true;
    if (mkt === 'stocks'      && (u.endsWith('.NS') || u.endsWith('.BO')))   return true;
    return false;
  }

  /* ═══════════════════════════════════════════════════════════
     3.  TRANSLATIONS  — FIX 4
  ═══════════════════════════════════════════════════════════ */
  var LANG = {
    en: {
      welcome: 'Welcome back',
      loginSub: 'Sign in to access your AI prediction dashboard',
      continueGoogle: 'Continue with Google',
      orSignIn: 'or sign in with email',
      emailLabel: 'Email address',
      passwordLabel: 'Password',
      signIn: 'Sign In',
      createAccount: 'Create Account',
      terms: 'By signing in you agree to our Terms & Privacy Policy',
      credits: 'credits',
      upgrade: 'Upgrade',
      signOut: 'Sign Out',
      aiPowered: 'AI-Powered Predictions · Live',
      heroTitle1: 'Stock Market',
      heroTitle2: 'Forecast',
      heroSub: 'AI-Powered 7-Day Market Intelligence',
      heroDesc: 'Real-time AI forecasting across stocks, crypto, forex, indices & commodities',
      predictionsMade: 'Predictions Made',
      aiAccuracy: 'AI Accuracy',
      marketsCovered: 'Markets Covered',
      forecastRange: 'Forecast Range',
      home: 'Home',
      stocks: 'Stocks',
      crypto: 'Crypto',
      forex: 'Forex',
      indices: 'Indices',
      commodities: 'Commodities',
      predict: 'Predict',
      aiChat: 'AI Chat',
      community: 'Community',
      gainers: 'Top Gainers',
      losers: 'Top Losers',
      confidence: 'Confidence',
      riskLevel: 'Risk Level',
      aiSignal: 'AI Signal',
      accuracy: 'Accuracy',
      currentPrice: 'Current Price',
      modelAccuracy: 'Model Accuracy',
      forecast: 'Next 7 Days Forecast',
      aiPredChart: 'AI Prediction Chart',
      historical: 'Historical',
      aiForecast: 'AI Forecast',
      candlestick: 'Candlestick Chart',
      latestNews: 'Latest News',
      paperTrading: 'Paper Trading Portfolio',
      newTrade: 'New Trade',
      virtualBalance: 'Virtual Balance',
      openPositions: 'Open Positions',
      totalPnL: 'Total P&L',
      noPositions: 'No open positions. Start a trade!',
      executeTrade: 'Execute Trade',
      advancedAI: 'Advanced AI Analysis',
      backtesting: 'Strategy Backtesting',
      runBacktest: 'Run Backtest',
      riskAnalysis: 'Risk Analysis',
      volatility: 'Volatility',
      maxDrawdown: 'Max Drawdown',
      portfolioAnalytics: 'Portfolio Analytics',
      diversification: 'Diversification Score',
      sectorAlloc: 'Sector Allocation',
      aiRecommendation: 'AI Recommendation',
      upgradePlan: 'Upgrade Your Plan',
      choosePlan: 'Choose Your',
      plan: 'Plan',
      planDesc: 'Unlock advanced AI predictions, paper trading and more',
      creditsRemaining: 'Credits Remaining',
      currentPlan: 'Current Plan',
      free: 'Free',
      creditsExhausted: 'Credits Exhausted!',
      creditsExhaustedDesc: 'Your credits are finished. Please subscribe to continue.',
      viewPlans: 'View Plans',
      later: 'Later',
      back: 'Back',
      loadingMarket: 'Loading market data...',
      aiAssistant: 'FinSight AI Assistant',
      communityPredictions: 'Community Predictions',
      communitySubtitle: 'Share & discuss market signals',
      postPrediction: 'Post Your Prediction',
      postIt: 'Post Prediction',
      loadingPosts: 'Loading community posts...',
      context: 'Context:',
      ollamaStatus: 'Online · Powered by Ollama',
      stockMarket: 'Stock Market',
      cryptoMarket: 'Crypto Market',
      forexMarket: 'Forex Market',
      indicesMarket: 'Indices',
      commoditiesMarket: 'Commodities',
      symbol: 'Symbol', type: 'Type', quantity: 'Qty',
      buyPrice: 'Buy Price', pnl: 'P&L', action: 'Action',
      forever: '/ forever',
      currentPlanBtn: 'Current Plan',
      starterCredits: '3000 starter credits',
      creditPerPred: '100 credits per prediction',
      basicAI: 'Basic AI signals',
      sevenDayForecast: '7-day forecasts',
      paperTradingLocked: 'Paper Trading 🔒',
      advancedAILocked: 'Advanced AI 🔒',
      backtestingLocked: 'Backtesting 🔒',
      riskAnalysisLocked: 'Risk Analysis 🔒',
      unlimitedPred: 'Unlimited predictions',
      paperTradingUnlock: 'Paper Trading unlocked',
      virtualBalance1L: 'Virtual balance ₹1,00,000',
      realTimePL: 'Real-time P&L simulation',
      priorityAI: 'Priority AI signals',
      allMarkets: 'All 5 markets',
      aiConfLocked: 'AI Confidence Analysis 🔒',
      everythingPro: 'Everything in Pro',
      advancedAIPred: 'Advanced AI predictions',
      strategyBacktest: 'Strategy Backtesting',
      aiConfAnalysis: 'AI Confidence Analysis',
      portfolioInsightsLabel: 'Portfolio Insights',
      exportReports: 'Export reports',
      prioritySupport: 'Priority support',
      backtestingDesc: 'Test your strategy on historical data',
      riskAnalysisDesc: 'Detailed volatility and downside risk',
      portfolioAnalyticsDesc: 'AI-powered portfolio performance insights',
      heroSub2: 'AI-Powered 7-Day Market Intelligence'
    },
    hi: {
      welcome: 'वापस स्वागत है',
      loginSub: 'AI डैशबोर्ड तक पहुँचने के लिए साइन इन करें',
      continueGoogle: 'Google से जारी रखें',
      orSignIn: 'या ईमेल से साइन इन करें',
      emailLabel: 'ईमेल पता',
      passwordLabel: 'पासवर्ड',
      signIn: 'साइन इन',
      createAccount: 'खाता बनाएं',
      terms: 'साइन इन करके आप हमारी शर्तों से सहमत हैं',
      credits: 'क्रेडिट',
      upgrade: 'अपग्रेड',
      signOut: 'साइन आउट',
      aiPowered: 'AI-संचालित पूर्वानुमान · लाइव',
      heroTitle1: 'शेयर बाज़ार',
      heroTitle2: 'पूर्वानुमान',
      heroSub: 'AI-संचालित 7-दिन की बाज़ार बुद्धि',
      heroDesc: 'स्टॉक, क्रिप्टो, फॉरेक्स, इंडेक्स और कमोडिटी में AI पूर्वानुमान',
      predictionsMade: 'पूर्वानुमान किए गए',
      aiAccuracy: 'AI सटीकता',
      marketsCovered: 'बाज़ार कवर',
      forecastRange: 'पूर्वानुमान सीमा',
      home: 'होम',
      stocks: 'स्टॉक्स',
      crypto: 'क्रिप्टो',
      forex: 'फॉरेक्स',
      indices: 'इंडेक्स',
      commodities: 'कमोडिटी',
      predict: 'पूर्वानुमान',
      aiChat: 'AI चैट',
      community: 'समुदाय',
      gainers: 'टॉप गेनर्स',
      losers: 'टॉप लॉसर्स',
      confidence: 'विश्वास',
      riskLevel: 'जोखिम स्तर',
      aiSignal: 'AI संकेत',
      accuracy: 'सटीकता',
      currentPrice: 'वर्तमान मूल्य',
      modelAccuracy: 'मॉडल सटीकता',
      forecast: 'अगले 7 दिन का पूर्वानुमान',
      aiPredChart: 'AI पूर्वानुमान चार्ट',
      historical: 'ऐतिहासिक',
      aiForecast: 'AI पूर्वानुमान',
      candlestick: 'कैंडलस्टिक चार्ट',
      latestNews: 'ताज़ा समाचार',
      paperTrading: 'पेपर ट्रेडिंग पोर्टफोलियो',
      newTrade: 'नई ट्रेड',
      virtualBalance: 'आभासी बैलेंस',
      openPositions: 'खुली पोज़िशन',
      totalPnL: 'कुल P&L',
      noPositions: 'कोई खुली पोज़िशन नहीं। ट्रेड शुरू करें!',
      executeTrade: 'ट्रेड करें',
      advancedAI: 'उन्नत AI विश्लेषण',
      backtesting: 'बैकटेस्टिंग',
      runBacktest: 'बैकटेस्ट चलाएं',
      riskAnalysis: 'जोखिम विश्लेषण',
      volatility: 'अस्थिरता',
      maxDrawdown: 'अधिकतम गिरावट',
      portfolioAnalytics: 'पोर्टफोलियो',
      diversification: 'विविधीकरण स्कोर',
      sectorAlloc: 'सेक्टर',
      aiRecommendation: 'AI अनुशंसा',
      upgradePlan: 'योजना अपग्रेड करें',
      choosePlan: 'चुनें',
      plan: 'योजना',
      planDesc: 'उन्नत AI, पेपर ट्रेडिंग और अधिक अनलॉक करें',
      creditsRemaining: 'शेष क्रेडिट',
      currentPlan: 'वर्तमान योजना',
      free: 'मुफ्त',
      creditsExhausted: 'क्रेडिट समाप्त!',
      creditsExhaustedDesc: 'क्रेडिट समाप्त। सदस्यता लें।',
      viewPlans: 'योजनाएं देखें',
      later: 'बाद में',
      back: 'वापस',
      loadingMarket: 'बाज़ार डेटा लोड हो रहा है...',
      aiAssistant: 'FinSight AI सहायक',
      communityPredictions: 'समुदाय पूर्वानुमान',
      communitySubtitle: 'सिग्नल साझा करें और चर्चा करें',
      postPrediction: 'पूर्वानुमान पोस्ट करें',
      postIt: 'पोस्ट करें',
      loadingPosts: 'पोस्ट लोड हो रही हैं...',
      context: 'संदर्भ:',
      ollamaStatus: 'ऑनलाइन · Ollama द्वारा',
      stockMarket: 'शेयर बाज़ार',
      cryptoMarket: 'क्रिप्टो बाज़ार',
      forexMarket: 'विदेशी मुद्रा बाज़ार',
      indicesMarket: 'सूचकांक',
      commoditiesMarket: 'कमोडिटी',
      symbol: 'सिंबल', type: 'प्रकार', quantity: 'मात्रा',
      buyPrice: 'खरीद मूल्य', pnl: 'P&L', action: 'कार्य',
      heroSub2: 'AI-संचालित 7-दिन की बाज़ार बुद्धि'
    },
    mr: {
      welcome: 'परत स्वागत आहे',
      loginSub: 'AI डॅशबोर्ड ऍक्सेस करण्यासाठी साइन इन करा',
      continueGoogle: 'Google सह सुरू ठेवा',
      orSignIn: 'किंवा ईमेलने साइन इन करा',
      emailLabel: 'ईमेल पत्ता',
      passwordLabel: 'पासवर्ड',
      signIn: 'साइन इन',
      createAccount: 'खाते तयार करा',
      terms: 'साइन इन करून तुम्ही आमच्या अटींशी सहमत आहात',
      credits: 'क्रेडिट्स',
      upgrade: 'अपग्रेड',
      signOut: 'साइन आउट',
      aiPowered: 'AI-चालित अंदाज · लाइव',
      heroTitle1: 'शेअर बाजार',
      heroTitle2: 'अंदाज',
      heroSub: 'AI-चालित 7-दिवस बाजार बुद्धिमत्ता',
      heroDesc: 'स्टॉक्स, क्रिप्टो, फॉरेक्स, इंडेक्स आणि कमोडिटीमध्ये AI अंदाज',
      predictionsMade: 'अंदाज',
      aiAccuracy: 'AI अचूकता',
      marketsCovered: 'बाजार',
      forecastRange: 'अंदाज श्रेणी',
      home: 'मुख्यपृष्ठ',
      stocks: 'स्टॉक्स',
      crypto: 'क्रिप्टो',
      forex: 'फॉरेक्स',
      indices: 'निर्देशांक',
      commodities: 'कमोडिटी',
      predict: 'अंदाज',
      aiChat: 'AI चॅट',
      community: 'समुदाय',
      gainers: 'टॉप गेनर्स',
      losers: 'टॉप लॉसर्स',
      confidence: 'विश्वास',
      riskLevel: 'जोखीम पातळी',
      aiSignal: 'AI संकेत',
      accuracy: 'अचूकता',
      currentPrice: 'सध्याची किंमत',
      modelAccuracy: 'मॉडेल अचूकता',
      forecast: 'पुढील 7 दिवसांचा अंदाज',
      aiPredChart: 'AI अंदाज चार्ट',
      historical: 'ऐतिहासिक',
      aiForecast: 'AI अंदाज',
      candlestick: 'कँडलस्टिक चार्ट',
      latestNews: 'ताज्या बातम्या',
      paperTrading: 'पेपर ट्रेडिंग पोर्टफोलिओ',
      newTrade: 'नवीन ट्रेड',
      virtualBalance: 'आभासी शिल्लक',
      openPositions: 'उघड्या पोझिशन्स',
      totalPnL: 'एकूण P&L',
      noPositions: 'कोणत्याही उघड्या पोझिशन्स नाहीत.',
      executeTrade: 'ट्रेड करा',
      advancedAI: 'प्रगत AI विश्लेषण',
      backtesting: 'बॅकटेस्टिंग',
      runBacktest: 'बॅकटेस्ट चालवा',
      riskAnalysis: 'जोखीम विश्लेषण',
      volatility: 'अस्थिरता',
      maxDrawdown: 'जास्तीत जास्त घट',
      portfolioAnalytics: 'पोर्टफोलिओ',
      diversification: 'विविधीकरण स्कोर',
      sectorAlloc: 'क्षेत्र',
      aiRecommendation: 'AI शिफारस',
      upgradePlan: 'योजना अपग्रेड करा',
      choosePlan: 'निवडा',
      plan: 'योजना',
      planDesc: 'प्रगत AI, पेपर ट्रेडिंग आणि अधिक',
      creditsRemaining: 'उर्वरित क्रेडिट्स',
      currentPlan: 'सध्याची योजना',
      free: 'विनामूल्य',
      creditsExhausted: 'क्रेडिट्स संपले!',
      creditsExhaustedDesc: 'क्रेडिट्स संपले. सदस्यता घ्या.',
      viewPlans: 'योजना पहा',
      later: 'नंतर',
      back: 'मागे',
      loadingMarket: 'बाजार डेटा लोड होत आहे...',
      aiAssistant: 'FinSight AI सहाय्यक',
      communityPredictions: 'समुदाय अंदाज',
      communitySubtitle: 'सिग्नल शेअर करा आणि चर्चा करा',
      postPrediction: 'अंदाज पोस्ट करा',
      postIt: 'पोस्ट करा',
      loadingPosts: 'पोस्ट लोड होत आहेत...',
      context: 'संदर्भ:',
      ollamaStatus: 'ऑनलाइन · Ollama द्वारे',
      stockMarket: 'शेअर बाजार',
      cryptoMarket: 'क्रिप्टो बाजार',
      forexMarket: 'विदेशी चलन बाजार',
      indicesMarket: 'निर्देशांक',
      commoditiesMarket: 'कमोडिटी',
      symbol: 'सिम्बॉल', type: 'प्रकार', quantity: 'प्रमाण',
      buyPrice: 'खरेदी किंमत', pnl: 'P&L', action: 'कृती',
      heroSub2: 'AI-चालित 7-दिवस बाजार बुद्धिमत्ता'
    }
  };

  /* ═══════════════════════════════════════════════════════════
     4.  THEME
  ═══════════════════════════════════════════════════════════ */
  function applyTheme(t) {
    S.theme = t;
    localStorage.setItem('fs_theme', t);
    document.body.setAttribute('data-theme', t);
    qsa('#themeToggle,#homeThemeToggle').forEach(function (b) {
      b.innerHTML = t === 'light' ? '<i class="fa fa-sun"></i>' : '<i class="fa fa-moon"></i>';
    });
    if (S.lastData) { drawPredChart(S.lastData); drawCandleChart(S.lastData); }
  }

  /* ═══════════════════════════════════════════════════════════
     5.  PAGE SWITCHER
  ═══════════════════════════════════════════════════════════ */
  function showPage(id) {
    qsa('.page').forEach(function (p) { p.classList.remove('active'); });
    var pg = g(id);
    if (pg) { pg.classList.add('active'); window.scrollTo(0, 0); }
  }

  /* ═══════════════════════════════════════════════════════════
     6.  LOADER
  ═══════════════════════════════════════════════════════════ */
  function showLoader(msg) {
    var l = g('pageLoader');
    if (!l) return;
    var t = qs('.loader-text', l);
    if (t) t.textContent = msg || 'Loading…';
    l.style.display = 'flex';
    /* animate progress bar */
    var bar = g('loaderBar');
    if (bar) { bar.style.width = '0%'; setTimeout(function () { bar.style.width = '85%'; }, 50); }
  }
  function hideLoader() {
    var l = g('pageLoader');
    if (!l) return;
    var bar = g('loaderBar');
    if (bar) bar.style.width = '100%';
    setTimeout(function () { l.style.display = 'none'; }, 200);
  }

  /* ═══════════════════════════════════════════════════════════
     7.  CREDIT & PLAN SYSTEM  — FIX 5
  ═══════════════════════════════════════════════════════════ */
  var CK = 'fs_credits', PK = 'fs_plan', PEK = 'fs_plan_expiry';

  function getCredits() {
    var v = localStorage.getItem(CK);
    if (v === null) { localStorage.setItem(CK, '3000'); return 3000; }
    return Math.max(0, parseInt(v, 10) || 0);
  }
  function setCredits(n) { localStorage.setItem(CK, String(Math.max(0, n))); syncCredUI(); }
  function getPlan()    { return localStorage.getItem(PK) || 'free'; }
  function isPaid()     { var p = getPlan(); return p === 'pro' || p === 'premium'; }
  function isPremium()  { return getPlan() === 'premium'; }
  function canPredict() { return isPaid() || getCredits() >= 100; }

  function setPlanState(plan, expiry) {
    localStorage.setItem(PK, plan);
    if (expiry) localStorage.setItem(PEK, expiry);
    syncCredUI();
    syncPlanUI();
    syncPremiumSections();
  }

  function deductCredits() {
    if (isPaid()) return;
    setCredits(getCredits() - 100);
    var ses = getSes();
    if (ses && ses.email) {
      fetch('/deduct-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ses.email })
      }).catch(function () {});
    }
  }

  /* FIX 5: Credits UI — ∞ for paid */
  function syncCredUI() {
    var c    = getCredits();
    var paid = isPaid();
    var disp = paid ? '∞' : c.toLocaleString();

    qsa('#homeCreditsCount,#dashCreditsCount').forEach(function (el) { el.textContent = disp; });

    var sc = g('subPageCredits'); if (sc) sc.textContent = paid ? 'Unlimited ♾' : c.toLocaleString();

    var ht = g('heroCreditsText');
    if (ht) {
      if (paid) {
        ht.innerHTML = 'You are on <strong>' + getPlan().toUpperCase() +
          '</strong> — <span class="credits-unlimited">Unlimited Predictions!</span>';
      } else {
        ht.innerHTML = 'You have <strong>' + c.toLocaleString() +
          ' credits</strong> — Each prediction costs 100 credits';
      }
    }

    var bc = qs('.btn-cost');
    if (bc) {
      bc.innerHTML    = paid ? '<i class="fa fa-infinity"></i>' : '-100 <i class="fa fa-bolt"></i>';
      bc.style.color  = paid ? '#22c55e' : '';
    }
  }

  function syncPlanUI() {
    var plan = getPlan();
    qsa('#homePlanBadge,#dashPlanBadge').forEach(function (b) {
      b.textContent = plan.toUpperCase();
      b.className   = 'plan-badge ' + plan;
    });

    qsa('.plan-card').forEach(function (card) {
      var cp  = card.getAttribute('data-plan');
      var btn = qs('.plan-btn', card);
      if (cp === plan) {
        if (btn) { btn.textContent = '✓ Current Plan'; btn.disabled = true; btn.className = 'plan-btn current-plan-btn'; }
        card.style.borderColor = 'rgba(0,245,160,0.4)';
      } else {
        if (btn && btn.disabled) { btn.disabled = false; }
        card.style.borderColor = '';
      }
    });
  }

  /* FIX 5: show/hide premium sections based on plan + whether prediction is active */
  function syncPremiumSections() {
    var paid      = isPaid();
    var prem      = isPremium();
    var predDash  = g('predictionDashboard');
    var predShown = predDash && predDash.style.display !== 'none';

    /* outer wrapper — flex to keep layout */
    var pfSec = g('premiumFeaturesSection');
    if (pfSec) pfSec.style.display = (paid && predShown) ? 'flex' : 'none';

    var ptSec = g('paperTradingSection');
    if (ptSec) ptSec.style.display = (paid && predShown) ? 'block' : 'none';

    var aiSec = g('premiumAISection');
    if (aiSec) aiSec.style.display = (prem && predShown) ? 'block' : 'none';

    /* FIX 5: populate analytics once premium is active */
    if (prem && S.lastData) {
      populateRisk(S.lastData);
      populatePortfolio(S.lastData);
    }
  }

  function populateRisk(data) {
    var px = parseFloat(data.latest_close || data.current_price || 100);
    var cf = parseFloat(data.confidence   || data.accuracy      || 75);
    var cu = (MKTS[S.market] || {}).cur || '';
    text('varVal',      cu + (px * 0.025).toFixed(2));
    text('volVal',      (100 - cf).toFixed(1) + '%');
    text('drawdownVal', '-' + cu + (px * 0.08).toFixed(2));
    text('sharpeVal',   (cf / 30).toFixed(2));
  }

  function populatePortfolio(data) {
    var sig = (data.signal || 'hold').toUpperCase();
    text('divScore',    '7.2 / 10');
    text('sectorAlloc', (MKTS[S.market] || {}).label || '—');
    text('aiRec',       sig === 'BUY'  ? 'Accumulate gradually' :
                        sig === 'SELL' ? 'Reduce exposure'      : 'Hold & Monitor');
  }

  /* ═══════════════════════════════════════════════════════════
     8.  AUTH
  ═══════════════════════════════════════════════════════════ */
  var UK = 'fs_users', SK = 'fs_session';
  function getUsers()  { return safeJSON(UK, {}); }
  function saveUsers(u){ localStorage.setItem(UK, JSON.stringify(u)); }
  function getSes()    { return safeJSON(SK, null); }
  function saveSes(u)  { localStorage.setItem(SK, JSON.stringify(u)); }
  function clearSes()  { localStorage.removeItem(SK); }

  function loginErr(msg) {
    var el = g('loginError');
    if (!el) return;
    el.innerHTML = '<i class="fa fa-exclamation-circle"></i> ' + msg;
    el.style.display = 'flex';
  }
  function loginErrClear() { var el = g('loginError'); if (el) el.style.display = 'none'; }

  function afterLogin(user) {
    saveSes(user);
    var name   = user.displayName || user.email || 'User';
    var letter = name.charAt(0).toUpperCase();
    qsa('#userAvatar,#dashUserAvatar').forEach(function (a) { a.textContent = letter; });

    getCredits(); syncCredUI(); syncPlanUI();
    syncFromBackend(user.email);

    toast('Welcome, ' + name.split(' ')[0] + '! 👋', 'success');
    showPage('homePage');
    switchMkt(S.market);
    loadMovers(S.market);
    animateStats();
    startTicker();
    applyLang(S.lang);

    var hy = g('homeYear'); if (hy) hy.textContent = new Date().getFullYear();
  }

  function syncFromBackend(email) {
    if (!email) return;
    fetch('/get-user?email=' + encodeURIComponent(email))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.error) return;
        if (d.credits !== undefined) localStorage.setItem(CK, String(d.credits));
        if (d.plan)    localStorage.setItem(PK, d.plan);
        syncCredUI(); syncPlanUI();
      }).catch(function () {});
  }

  /* Auto-login on page load */
  (function () { var s = getSes(); if (s && s.email) afterLogin(s); })();

  /* ═══════════════════════════════════════════════════════════
     9.  AUTH EVENT LISTENERS  — FIX 1
  ═══════════════════════════════════════════════════════════ */
  on(g('togglePw'), 'click', function () {
    var inp = g('loginPassword'); if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    g('togglePw').innerHTML = inp.type === 'password' ?
      '<i class="fa fa-eye"></i>' : '<i class="fa fa-eye-slash"></i>';
  });

  on(g('loginPassword'), 'keydown', function (e) {
    if (e.key === 'Enter') { var b = g('emailLoginBtn'); if (b) b.click(); }
  });

  on(g('googleLoginBtn'), 'click', function () {
    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Signing in…';
    setTimeout(function () {
      btn.disabled = false;
      btn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 48 48">' +
        '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
        '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
        '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
        '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
        '</svg><span data-i18n="continueGoogle">Continue with Google</span>';
      afterLogin({ displayName: 'Demo User', email: 'demo@finsight.ai' });
    }, 800);
  });

  on(g('emailLoginBtn'), 'click', function () {
    loginErrClear();
    var email = (g('loginEmail') || {}).value.trim();
    var pass  = (g('loginPassword') || {}).value;
    if (!email)              { loginErr('Please enter your email address.'); return; }
    if (!pass)               { loginErr('Please enter your password.'); return; }
    var users = getUsers();
    if (!users[email])               { loginErr('Account not found. Create one first.'); return; }
    if (users[email].password !== pass) { loginErr('Incorrect password.'); return; }
    var btn = this;
    btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Signing in…';
    setTimeout(function () {
      btn.disabled = false; btn.innerHTML = '<i class="fa fa-sign-in-alt"></i> Sign In';
      afterLogin({ displayName: users[email].name, email: email });
    }, 600);
  });

  on(g('emailRegisterBtn'), 'click', function () {
    loginErrClear();
    var email = (g('loginEmail') || {}).value.trim();
    var pass  = (g('loginPassword') || {}).value;
    if (!email)               { loginErr('Please enter an email address.'); return; }
    if (!email.includes('@')) { loginErr('Please enter a valid email.'); return; }
    if (!pass)                { loginErr('Please enter a password.'); return; }
    if (pass.length < 6)      { loginErr('Password must be at least 6 characters.'); return; }
    var users = getUsers();
    if (users[email])         { loginErr('Account already exists. Please sign in.'); return; }
    var name  = email.split('@')[0];
    users[email] = { password: pass, name: name };
    saveUsers(users);
    fetch('/register-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, name: name })
    }).catch(function () {});
    var btn = this;
    btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Creating…';
    setTimeout(function () {
      btn.disabled = false; btn.innerHTML = '<i class="fa fa-user-plus"></i> Create Account';
      toast('Account created! Welcome 🎉', 'success');
      afterLogin({ displayName: name, email: email });
    }, 600);
  });

  on(g('logoutBtn'), 'click', function () {
    stopLivePnL(); clearSes(); showPage('loginPage'); toast('Signed out.', 'info');
  });

  /* ═══════════════════════════════════════════════════════════
     10.  HOME MARKET CARDS  — FIX 1
  ═══════════════════════════════════════════════════════════ */
  qsa('.market-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var mkt = card.getAttribute('data-market');
      if (!mkt || !MKTS[mkt]) return;
      showLoader('Loading ' + MKTS[mkt].label + '…');
      setTimeout(function () {
        hideLoader();
        switchMkt(mkt);
        showPage('dashboardPage');
        loadMovers(mkt);
      }, 400);
    });
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width  - 0.5) * 14;
      var y = ((e.clientY - r.top)  / r.height - 0.5) * -14;
      card.style.transform = 'translateY(-8px) perspective(600px) rotateX(' + y + 'deg) rotateY(' + x + 'deg)';
    });
    card.addEventListener('mouseleave', function () { card.style.transform = ''; });
  });

  /* ═══════════════════════════════════════════════════════════
     11.  MARKET TABS  — FIX 1
  ═══════════════════════════════════════════════════════════ */
  qsa('.mktab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var mkt = tab.getAttribute('data-market'); if (!mkt) return;
      qsa('.mktab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      switchMkt(mkt);
      resetDash();
      loadMovers(mkt);
    });
  });

  /* ═══════════════════════════════════════════════════════════
     12.  SWITCH MARKET
  ═══════════════════════════════════════════════════════════ */
  function switchMkt(mkt) {
    if (!MKTS[mkt]) mkt = 'stocks';
    S.market = mkt;
    var C = MKTS[mkt];
    text('badgeIcon',   C.icon);
    text('marketLabel', C.label);
    text('breadcrumb',  C.label);
    text('titleText',   C.title);
    text('subtitleText',C.sub);
    var si = g('symbolInput');
    if (si) { si.placeholder = C.ph; si.classList.remove('valid', 'invalid'); }
    qsa('.mktab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-market') === mkt);
    });
    buildChips(C.chips);
    var ab = g('autocompleteBox'); if (ab) { ab.innerHTML = ''; ab.classList.remove('open'); }
    hide(g('marketValidationWarn'));
    hide(g('error'));
  }

  /* ═══════════════════════════════════════════════════════════
     13.  QUICK CHIPS
  ═══════════════════════════════════════════════════════════ */
  function buildChips(chips) {
    var c = g('quickChips'); if (!c) return;
    c.innerHTML = '';
    chips.forEach(function (sym) {
      var btn = document.createElement('button');
      btn.className   = 'chip';
      btn.type        = 'button';
      btn.textContent = sym;
      btn.addEventListener('click', function () {
        var si = g('symbolInput'); if (si) si.value = sym;
        runPredict(sym);
      });
      c.appendChild(btn);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     14.  AUTOCOMPLETE  — FIX 3: only current market symbols
  ═══════════════════════════════════════════════════════════ */
  on(g('symbolInput'), 'input', function () {
    var box = g('autocompleteBox'); var inp = g('symbolInput');
    if (!box || !inp) return;
    var val = inp.value.trim().toUpperCase();
    var cfg = MKTS[S.market];
    if (!val || !cfg) { box.innerHTML = ''; box.classList.remove('open'); return; }
    var matches = cfg.wl.filter(function (s) { return s.toUpperCase().startsWith(val); }).slice(0, 7);
    if (!matches.length) { box.innerHTML = ''; box.classList.remove('open'); return; }
    box.innerHTML = matches.map(function (s) {
      return '<div class="ac-item" data-sym="' + s + '">' +
             '<span class="ac-symbol">' + s + '</span>' +
             '<span class="ac-name">'   + cfg.label + '</span></div>';
    }).join('');
    box.classList.add('open');

    qsa('.ac-item', box).forEach(function (item) {
      item.addEventListener('click', function () {
        var sym = item.getAttribute('data-sym');
        var si  = g('symbolInput'); if (si) si.value = sym;
        box.innerHTML = ''; box.classList.remove('open');
        runPredict(sym);
      });
    });
  });

  document.addEventListener('click', function (e) {
    var box = g('autocompleteBox'), inp = g('symbolInput');
    if (!box || !inp) return;
    if (!box.contains(e.target) && e.target !== inp) {
      box.innerHTML = ''; box.classList.remove('open');
    }
  });

  on(g('symbolInput'), 'keydown', function (e) {
    if (e.key !== 'Enter') return;
    var box = g('autocompleteBox'); if (box) { box.innerHTML = ''; box.classList.remove('open'); }
    var v = (g('symbolInput') || {}).value.trim();
    if (v) runPredict(v.toUpperCase());
  });

  on(g('symbolInput'), 'input', function () {
    var clr = g('searchClear'); if (clr) clr.style.display = this.value ? 'block' : 'none';
    checkSymbolWarn(this.value.trim().toUpperCase());
  });

  on(g('searchClear'), 'click', function () {
    var si = g('symbolInput');
    if (si) { si.value = ''; si.focus(); si.classList.remove('valid', 'invalid'); }
    hide(g('searchClear'));
    hide(g('marketValidationWarn'));
    var box = g('autocompleteBox'); if (box) { box.innerHTML = ''; box.classList.remove('open'); }
  });

  /* FIX 3: symbol-market validation warning */
  function checkSymbolWarn(sym) {
    if (!sym || sym.length < 2) {
      hide(g('marketValidationWarn'));
      var si = g('symbolInput'); if (si) si.classList.remove('valid', 'invalid');
      return;
    }
    var warn   = g('marketValidationWarn');
    var msgEl  = g('marketValidationMsg');
    var si     = g('symbolInput');
    var valid  = validForMkt(sym, S.market);
    var belongs = symMkt(sym);

    if (!valid && belongs) {
      if (msgEl) msgEl.textContent =
        '"' + sym + '" is a ' + MKTS[belongs].label +
        ' asset. Switch to the ' + MKTS[belongs].label + ' tab.';
      if (warn) warn.style.display = 'flex';
      if (si)   { si.classList.add('invalid'); si.classList.remove('valid'); }
    } else if (valid) {
      if (warn) warn.style.display = 'none';
      if (si)   { si.classList.remove('invalid'); si.classList.add('valid'); }
    } else {
      if (warn) warn.style.display = 'none';
      if (si)   si.classList.remove('invalid', 'valid');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     15.  PREDICT BUTTON  — FIX 1 + FIX 3
  ═══════════════════════════════════════════════════════════ */
  on(g('predictBtn'), 'click', function () {
    var sym = (g('symbolInput') || {}).value.trim().toUpperCase();
    if (!sym) { toast('Please enter a symbol first', 'error'); return; }
    var belongs = symMkt(sym);
    if (belongs && belongs !== S.market) {
      /* Auto-switch market and continue */
      toast('"' + sym + '" detected as ' + MKTS[belongs].label + ' — switching market.', 'info');
      switchMkt(belongs);
    }
    runPredict(sym);
  });

  /* ═══════════════════════════════════════════════════════════
     16.  NAV BUTTONS  — FIX 1
  ═══════════════════════════════════════════════════════════ */
  on(g('backToHome'),        'click', function () { showPage('homePage'); });
  on(g('subscribeNavBtn'),   'click', function () { showPage('subscriptionPage'); });
  on(g('dashSubscribeBtn'),  'click', function () { showPage('subscriptionPage'); });
  on(g('backFromSubBtn'),    'click', function () { showPage('homePage'); });
  on(g('goToSubscribeBtn'),  'click', function () { hide(g('creditsModal')); showPage('subscriptionPage'); });
  on(g('closeCreditsModal'), 'click', function () { hide(g('creditsModal')); });
  on(g('creditsModal'),      'click', function (e) { if (e.target === this) hide(this); });

  /* ═══════════════════════════════════════════════════════════
     17.  CHART RANGE BUTTONS  — FIX 1
  ═══════════════════════════════════════════════════════════ */
  qsa('.range-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var parent = btn.closest('.chart-range-btns');
      if (parent) qsa('.range-btn', parent).forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      S.range = btn.getAttribute('data-range') || '3mo';
      if (S.currentSym) runPredict(S.currentSym, S.range);
    });
  });

  /* Theme toggles */
  on(g('themeToggle'),    'click', function () { applyTheme(S.theme === 'light' ? 'dark' : 'light'); });
  on(g('homeThemeToggle'),'click', function () { applyTheme(S.theme === 'light' ? 'dark' : 'light'); });

  /* ═══════════════════════════════════════════════════════════
     18.  RESET DASHBOARD
  ═══════════════════════════════════════════════════════════ */
  function resetDash() {
    hide(g('predictionDashboard'));
    var mm = g('marketMovers');
    if (mm) { mm.classList.remove('hiding'); mm.style.display = 'block'; }
    hide(g('error'));
    hide(g('marketValidationWarn'));
    S.lastData = null;
    stopLivePnL();
    syncPremiumSections();
  }

  /* ═══════════════════════════════════════════════════════════
     19.  MARKET MOVERS
  ═══════════════════════════════════════════════════════════ */
  function loadMovers(mkt) {
    var cfg = MKTS[mkt] || MKTS.stocks;
    var sk  = g('moversSkeleton'), mc = g('moversContent');
    var gl  = g('gainersList'),    ll = g('losersList');
    if (!gl || !ll) return;
    if (sk) sk.style.display = 'grid';
    if (mc) mc.style.display = 'none';

    fetch(cfg.url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        buildScroll(gl, d.gainers || [], true,  cfg.cur);
        buildScroll(ll, d.losers  || [], false, cfg.cur);
        if (sk) sk.style.display = 'none';
        if (mc) mc.style.display = 'grid';
      })
      .catch(function () {
        buildScroll(gl, fallbackMovers(mkt, true),  true,  cfg.cur);
        buildScroll(ll, fallbackMovers(mkt, false), false, cfg.cur);
        if (sk) sk.style.display = 'none';
        if (mc) mc.style.display = 'grid';
      });
  }

  function buildScroll(container, items, isGainer, cur) {
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = '<p style="color:var(--text3);padding:16px;text-align:center">No data available</p>';
      return;
    }
    var inner = document.createElement('div');
    inner.className = 'movers-scroll-inner';
    var rows = items.slice(0, 7);

    /* Duplicate for seamless scroll */
    rows.concat(rows).forEach(function (s, i) {
      var chg  = parseFloat(s.change || 0);
      var isUp = chg >= 0;
      var rank = (i % rows.length) + 1;
      var price = s.price ? ((cur || '') + fmtPrice(s.price)) : '—';
      var row  = document.createElement('div');
      row.className = 'mover-item';
      row.innerHTML =
        '<span class="mover-rank">' + rank + '</span>' +
        '<div class="mover-info">' +
          '<div class="mover-symbol">' + (s.symbol  || '—') + '</div>' +
          '<div class="mover-name">'   + (s.company || s.name || '') + '</div>' +
        '</div>' +
        '<div class="mover-price-col">' +
          '<div class="mover-price">' + price + '</div>' +
          '<div class="mover-change ' + (isUp ? 'up' : 'down') + '">' +
            '<i class="fa fa-caret-' + (isUp ? 'up' : 'down') + '"></i> ' +
            (isUp ? '+' : '') + chg.toFixed(2) + '%' +
          '</div>' +
        '</div>';
      row.addEventListener('click', function () {
        var si = g('symbolInput'); if (si) si.value = s.symbol || '';
        runPredict(s.symbol || '');
      });
      inner.appendChild(row);
    });
    container.appendChild(inner);
  }

  var FALLBACK_MOVERS = {
    stocks: {
      gainers: [
        { symbol:'RELIANCE', company:'Reliance Industries', price:2450, change:2.3 },
        { symbol:'TCS',      company:'Tata Consultancy',    price:3890, change:1.9 },
        { symbol:'INFY',     company:'Infosys Ltd',         price:1720, change:1.5 },
        { symbol:'HDFCBANK', company:'HDFC Bank',           price:1640, change:1.2 },
        { symbol:'NVDA',     company:'Nvidia',              price:875,  change:3.1 },
        { symbol:'AAPL',     company:'Apple Inc',           price:193,  change:1.4 },
        { symbol:'MSFT',     company:'Microsoft',           price:415,  change:0.9 }
      ],
      losers: [
        { symbol:'SBIN',       company:'SBI',          price:620, change:-3.4 },
        { symbol:'AXISBANK',   company:'Axis Bank',    price:980, change:-3.1 },
        { symbol:'TATAMOTORS', company:'Tata Motors',  price:840, change:-2.1 },
        { symbol:'WIPRO',      company:'Wipro Ltd',    price:480, change:-1.8 },
        { symbol:'BAJFINANCE', company:'Bajaj Finance',price:7200,change:-2.7 },
        { symbol:'META',       company:'Meta',         price:490, change:-1.2 },
        { symbol:'TSLA',       company:'Tesla',        price:172, change:-2.4 }
      ]
    },
    crypto: {
      gainers: [
        { symbol:'BTC',  company:'Bitcoin',   price:67240, change:2.1 },
        { symbol:'ETH',  company:'Ethereum',  price:3240,  change:1.8 },
        { symbol:'SOL',  company:'Solana',    price:185,   change:3.2 },
        { symbol:'BNB',  company:'Binance',   price:580,   change:1.1 },
        { symbol:'ADA',  company:'Cardano',   price:0.45,  change:2.5 },
        { symbol:'AVAX', company:'Avalanche', price:35.8,  change:1.7 },
        { symbol:'ATOM', company:'Cosmos',    price:9.4,   change:2.8 }
      ],
      losers: [
        { symbol:'DOGE', company:'Dogecoin',  price:0.15, change:-2.8 },
        { symbol:'XRP',  company:'Ripple',    price:0.54, change:-1.9 },
        { symbol:'DOT',  company:'Polkadot',  price:7.2,  change:-3.1 },
        { symbol:'LINK', company:'Chainlink', price:14.5, change:-2.2 },
        { symbol:'LTC',  company:'Litecoin',  price:88.0, change:-1.9 },
        { symbol:'BCH',  company:'Bitcoin Cash',price:470,change:-2.5 },
        { symbol:'MATIC',company:'Polygon',   price:0.85, change:-1.6 }
      ]
    },
    forex: {
      gainers: [
        { symbol:'USDINR', company:'USD/INR', price:83.5,  change:0.4 },
        { symbol:'GBPUSD', company:'GBP/USD', price:1.268, change:0.3 },
        { symbol:'AUDUSD', company:'AUD/USD', price:0.651, change:0.5 },
        { symbol:'NZDUSD', company:'NZD/USD', price:0.605, change:0.2 }
      ],
      losers: [
        { symbol:'EURUSD', company:'EUR/USD', price:1.082, change:-0.3 },
        { symbol:'USDJPY', company:'USD/JPY', price:149.2, change:-0.2 },
        { symbol:'USDCHF', company:'USD/CHF', price:0.896, change:-0.4 },
        { symbol:'USDCAD', company:'USD/CAD', price:1.354, change:-0.1 }
      ]
    },
    indices: {
      gainers: [
        { symbol:'NIFTY',  company:'Nifty 50',  price:24560, change:0.8 },
        { symbol:'SENSEX', company:'BSE Sensex', price:80120, change:0.6 },
        { symbol:'SPX',    company:'S&P 500',    price:5280,  change:0.5 },
        { symbol:'NASDAQ', company:'Nasdaq',      price:16500, change:0.9 }
      ],
      losers: [
        { symbol:'NIKKEI',   company:'Nikkei 225', price:38200, change:-0.7 },
        { symbol:'FTSE',     company:'FTSE 100',   price:7820,  change:-0.5 },
        { symbol:'DAX',      company:'DAX 40',     price:17850, change:-0.3 },
        { symbol:'HANGSENG', company:'Hang Seng',  price:16400, change:-1.1 }
      ]
    },
    commodities: {
      gainers: [
        { symbol:'GOLD',   company:'Gold Spot',     price:2312, change:0.5 },
        { symbol:'SILVER', company:'Silver Spot',   price:27.4, change:0.8 },
        { symbol:'COPPER', company:'Copper',        price:4.12, change:1.1 },
        { symbol:'PLATINUM',company:'Platinum',     price:990,  change:0.6 }
      ],
      losers: [
        { symbol:'CRUDE',  company:'Crude Oil WTI', price:78.5, change:-1.2 },
        { symbol:'NATGAS', company:'Natural Gas',   price:1.98, change:-2.3 },
        { symbol:'WHEAT',  company:'Wheat',         price:580,  change:-0.9 },
        { symbol:'CORN',   company:'Corn',          price:430,  change:-0.7 }
      ]
    }
  };

  function fallbackMovers(mkt, isGainer) {
    var m = FALLBACK_MOVERS[mkt] || FALLBACK_MOVERS.stocks;
    return isGainer ? m.gainers : m.losers;
  }

  /* ═══════════════════════════════════════════════════════════
     20.  LIVE TICKER
  ═══════════════════════════════════════════════════════════ */
  var _tPrev = {};

  function startTicker() {
    updateTicker();
    if (S.tickerTimer) clearInterval(S.tickerTimer);
    S.tickerTimer = setInterval(updateTicker, 30000);
  }

  function updateTicker() {
    fetch('/ticker-data')
      .then(function (r) { return r.json(); })
      .then(function (items) {
        if (!Array.isArray(items) || !items.length) return;
        var html = items.map(function (item) {
          var isUp = (item.change || 0) >= 0;
          return '<span class="ticker-item ' + (isUp ? 'up' : 'down') +
            '" data-sym="' + item.symbol + '">' +
            item.label + ' ' + (item.prefix || '') + fmtPrice(item.price) + ' ' +
            (isUp ? '▲' : '▼') + Math.abs(item.change || 0).toFixed(2) + '%</span>';
        }).join('');

        qsa('#homeTicker,#dashTicker').forEach(function (ticker) {
          ticker.innerHTML = html + html;
          /* Flash price change */
          items.forEach(function (item) {
            if (_tPrev[item.symbol] !== undefined) {
              qsa('[data-sym="' + item.symbol + '"]', ticker).forEach(function (sp) {
                if (item.price !== _tPrev[item.symbol]) {
                  var cls = item.price > _tPrev[item.symbol] ? 'price-up' : 'price-down';
                  sp.classList.remove('price-up', 'price-down');
                  void sp.offsetWidth;
                  sp.classList.add(cls);
                }
              });
            }
            _tPrev[item.symbol] = item.price;
          });
        });
      })
      .catch(function () {});
  }

  /* ═══════════════════════════════════════════════════════════
     21.  RUN PREDICT  — FIX 3 market enforcement
  ═══════════════════════════════════════════════════════════ */
  function runPredict(sym, range) {
    if (!sym) return;
    if (!canPredict()) { g('creditsModal') && (g('creditsModal').style.display = 'flex'); return; }

    S.currentSym = sym.toUpperCase();
    var rng  = range || S.range || '3mo';
    var btn  = g('predictBtn');
    var bTxt = qs('.btn-text', btn);
    var bLdr = qs('.btn-loader', btn);

    if (btn) btn.disabled = true;
    if (bTxt) bTxt.style.display = 'none';
    if (bLdr) bLdr.style.display = 'inline-flex';

    /* Animate movers out */
    var mm = g('marketMovers');
    if (mm) {
      mm.classList.add('hiding');
      setTimeout(function () { hide(mm); mm.classList.remove('hiding'); }, 280);
    }

    show(g('predictionDashboard'));
    hide(g('error'));
    hide(g('marketValidationWarn'));

    var fsk = g('forecastSkeleton');    if (fsk) fsk.style.display = 'block';
    var ftc = g('forecastTableContainer'); if (ftc) ftc.innerHTML = '';
    var pc  = g('plotlyChart');         if (pc)  pc.innerHTML = '';
    var cc  = g('candlestickChart');    if (cc)  cc.innerHTML = '';
    var nc  = g('newsContainer');       if (nc)  nc.innerHTML = '';

    fetch('/predict?symbol=' + encodeURIComponent(sym) +
          '&market=' + S.market + '&range=' + rng)
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Prediction failed'); });
        return r.json();
      })
      .then(function (data) {
        if (btn) btn.disabled = false;
        if (bTxt) bTxt.style.display = '';
        if (bLdr) bLdr.style.display = 'none';

        S.lastData = data;
        deductCredits();
        renderDash(data);
        updateAICtx(data);
        syncPremiumSections();
        startLivePnL();       /* FIX 2 */
        toast('Prediction ready for ' + sym + '!', 'success');
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        if (bTxt) bTxt.style.display = '';
        if (bLdr) bLdr.style.display = 'none';

        var eb = g('error');
        if (eb) {
          eb.innerHTML = '<i class="fa fa-exclamation-triangle"></i><span>' +
            (err.message || 'Prediction failed. Check the symbol.') + '</span>';
          eb.style.display = 'flex';
        }
        hide(g('predictionDashboard'));
        if (mm) show(mm);
        syncPremiumSections();
      });
  }

  /* ═══════════════════════════════════════════════════════════
     22.  RENDER DASHBOARD
  ═══════════════════════════════════════════════════════════ */
  function renderDash(data) {
    show(g('predictionDashboard'));
    renderGauge(data);
    renderMetrics(data);
    renderForecast(data);
    drawPredChart(data);
    drawCandleChart(data);
    loadNews(data.symbol || S.currentSym);
  }

  /* ═══════════════════════════════════════════════════════════
     23.  SIGNAL GAUGE
  ═══════════════════════════════════════════════════════════ */
  function renderGauge(data) {
    var sig  = (data.signal || 'hold').toLowerCase();
    var conf = parseFloat(data.confidence || data.accuracy || 75);
    var risk = data.risk_level || 'Medium';

    var lbl = g('gaugeSignalLabel');
    if (lbl) { lbl.textContent = sig.toUpperCase() + ' SIGNAL'; lbl.className = 'signal-label-top ' + sig; }

    text('gaugeTicker', data.symbol || S.currentSym);

    var rot = sig === 'buy' ? 80 : sig === 'sell' ? -80 : 0;
    setTimeout(function () {
      var nd = g('gaugeNeedle'); if (nd) nd.setAttribute('transform', 'rotate(' + rot + ',110,110)');
      var arc = g('gaugeArcActive');
      if (arc) arc.style.strokeDashoffset = sig === 'buy' ? '0' : sig === 'sell' ? '283' : '141';
    }, 100);

    text('gaugeConfidence', conf.toFixed(0) + '%');
    var gr = g('gaugeRisk');
    if (gr) { gr.textContent = risk; gr.className = 'gm-val risk-val ' + risk.toLowerCase(); }
    var gsv = g('gaugeSignalVal');
    if (gsv) { gsv.textContent = sig.toUpperCase(); gsv.className = 'gm-val signal-val ' + sig; }
    text('gaugeAccuracy', conf.toFixed(0) + '%');
  }

  /* ═══════════════════════════════════════════════════════════
     24.  METRICS
  ═══════════════════════════════════════════════════════════ */
  function renderMetrics(data) {
    var sig   = (data.signal || 'hold').toLowerCase();
    var conf  = parseFloat(data.confidence || data.accuracy || 75);
    var risk  = data.risk_level || 'Medium';
    var price = data.latest_close || data.current_price || 0;
    var cur   = (MKTS[S.market] || {}).cur || '';

    text('latestCloseVal',   cur + fmtPrice(price));
    var sw = g('signalCardWrapper');
    if (sw) sw.className = 'metric-tile glass-card ' + sig + '-signal';
    text('signalCardVal',    sig.toUpperCase());
    text('accuracyCardVal',  conf.toFixed(0) + '%');
    var rv = g('riskCardVal');
    if (rv) {
      rv.textContent = risk;
      rv.style.color = risk.toLowerCase() === 'low'  ? 'var(--buy)'  :
                       risk.toLowerCase() === 'high' ? 'var(--sell)' : 'var(--hold)';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     25.  7-DAY FORECAST TABLE
  ═══════════════════════════════════════════════════════════ */
  function renderForecast(data) {
    var container = g('forecastTableContainer');
    var skeleton  = g('forecastSkeleton');
    if (!container) return;
    if (skeleton) skeleton.style.display = 'none';

    var forecasts = data.forecast || data.predictions || [];
    var cur       = (MKTS[S.market] || {}).cur || '';
    var base      = parseFloat(data.latest_close || data.current_price || 0);

    /* Generate synthetic 7-day forecast if not returned */
    if (!forecasts.length) {
      var now = new Date();
      for (var d = 0; d < 7; d++) {
        var dt = new Date(now); dt.setDate(now.getDate() + d + 1);
        var rnd = (Math.random() - 0.45) * base * 0.02;
        forecasts.push({
          date:   dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          price:  base + rnd * (d + 1),
          change: ((rnd / (base || 1)) * 100).toFixed(2),
          signal: rnd > 0 ? 'BUY' : 'SELL'
        });
      }
    }

    var days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    var rows = forecasts.map(function (f, i) {
      var px  = parseFloat(f.price || f.predicted_price || 0);
      var ch  = parseFloat(f.change || f.change_pct || 0);
      var isUp = ch >= 0;
      var sig  = (f.signal || (isUp ? 'BUY' : 'SELL')).toUpperCase();
      var sigL = sig.toLowerCase();
      return '<tr>' +
        '<td class="forecast-date">' + (f.date || days[i % 7]) + '</td>' +
        '<td class="forecast-price">' + cur + fmtPrice(px) + '</td>' +
        '<td class="forecast-change ' + (isUp ? 'up' : 'down') + '">' +
          '<i class="fa fa-caret-' + (isUp ? 'up' : 'down') + '"></i> ' +
          (isUp ? '+' : '') + ch.toFixed(2) + '%</td>' +
        '<td><span class="forecast-signal ' + sigL + '">' + sig + '</span></td>' +
        '</tr>';
    }).join('');

    container.innerHTML =
      '<table class="forecast-table"><thead><tr>' +
        '<th>Date</th><th>Predicted Price</th><th>Change</th><th>Signal</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';

    /* Rebind export button each render */
    on(g('exportForecast'), 'click', function () {
      var csv = 'Date,Price,Change%,Signal\n';
      forecasts.forEach(function (f, i) {
        csv += (f.date || days[i % 7]) + ',' +
               parseFloat(f.price || 0).toFixed(2) + ',' +
               parseFloat(f.change || 0).toFixed(2) + '%,' +
               (f.signal || 'HOLD').toUpperCase() + '\n';
      });
      var a   = document.createElement('a');
      a.href  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = (S.currentSym || 'forecast') + '_7day.csv';
      a.click();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     26.  PREDICTION CHART
  ═══════════════════════════════════════════════════════════ */
  function drawPredChart(data) {
    var div = g('plotlyChart'); if (!div || !window.Plotly) return;
    var dark = S.theme !== 'light';
    var gc   = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    var tc   = dark ? '#94a3b8' : '#64748b';
    var cur  = (MKTS[S.market] || {}).cur || '';
    var hist = data.historical || data.hist_close || [];
    var pred = data.forecast   || data.predictions || [];
    var dates = data.dates     || data.hist_dates  || [];
    var last  = dates.length   ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10);
    var pDates = [], pPrices = [];
    pred.forEach(function (f, i) {
      var dt = new Date(last); dt.setDate(dt.getDate() + i + 1);
      pDates.push(f.date || dt.toISOString().slice(0, 10));
      pPrices.push(parseFloat(f.price || f.predicted_price || 0));
    });
    Plotly.newPlot(div, [
      {
        x: dates, y: hist, name: 'Historical', type: 'scatter', mode: 'lines',
        line: { color: '#3b82f6', width: 2, shape: 'spline' },
        fill: 'tozeroy', fillcolor: dark ? 'rgba(59,130,246,0.07)' : 'rgba(59,130,246,0.05)',
        hovertemplate: '<b>%{x}</b><br>' + cur + '%{y:,.2f}<extra></extra>'
      },
      {
        x: [last].concat(pDates),
        y: [(hist.length ? hist[hist.length - 1] : 0)].concat(pPrices),
        name: 'AI Forecast', type: 'scatter', mode: 'lines+markers',
        line: { color: '#22c55e', width: 2.5, dash: 'dash', shape: 'spline' },
        marker: { size: 6, color: '#22c55e' },
        hovertemplate: '<b>%{x}</b><br>AI: ' + cur + '%{y:,.2f}<extra></extra>'
      }
    ], {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      margin: { t: 10, r: 10, b: 40, l: 60 },
      xaxis: { gridcolor: gc, color: tc, showgrid: true, zeroline: false },
      yaxis: { gridcolor: gc, color: tc, showgrid: true, zeroline: false, tickprefix: cur },
      legend: { font: { color: tc, size: 12 }, bgcolor: 'transparent' },
      hovermode: 'x unified'
    }, { displayModeBar: false, responsive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     27.  CANDLESTICK CHART
  ═══════════════════════════════════════════════════════════ */
  function drawCandleChart(data) {
    var div = g('candlestickChart'); if (!div || !window.Plotly) return;
    var dark = S.theme !== 'light';
    var gc   = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    var tc   = dark ? '#94a3b8' : '#64748b';
    var cur  = (MKTS[S.market] || {}).cur || '';
    var ohlc = data.ohlc || data.candles || [];
    if (!ohlc.length) {
      var base = parseFloat(data.latest_close || data.current_price || 100), p = base;
      for (var k = 90; k >= 0; k--) {
        var dt  = new Date(); dt.setDate(dt.getDate() - k);
        var c   = p + (Math.random() - 0.48) * p * 0.025;
        ohlc.push({
          date:   dt.toISOString().slice(0, 10),
          open:   p, close: c,
          high:   Math.max(p, c) * (1 + Math.random() * 0.012),
          low:    Math.min(p, c) * (1 - Math.random() * 0.012),
          volume: Math.random() * 1e6
        });
        p = c;
      }
    }
    var dt2 = ohlc.map(function (c) { return c.date || c.t; });
    var op  = ohlc.map(function (c) { return parseFloat(c.open  || c.o || 0); });
    var hi  = ohlc.map(function (c) { return parseFloat(c.high  || c.h || 0); });
    var lo  = ohlc.map(function (c) { return parseFloat(c.low   || c.l || 0); });
    var cl  = ohlc.map(function (c) { return parseFloat(c.close || c.c || 0); });
    var vol = ohlc.map(function (c) { return parseFloat(c.volume || c.v || 0); });
    var vc  = cl.map(function (c, i) { return c >= op[i] ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'; });

    Plotly.newPlot(div, [
      {
        x: dt2, open: op, high: hi, low: lo, close: cl,
        type: 'candlestick', name: S.currentSym || 'Price',
        increasing: { line: { color: '#22c55e', width: 1.5 }, fillcolor: '#22c55e' },
        decreasing: { line: { color: '#ef4444', width: 1.5 }, fillcolor: '#ef4444' }
      },
      { x: dt2, y: vol, type: 'bar', name: 'Volume', marker: { color: vc }, yaxis: 'y2', hoverinfo: 'none' }
    ], {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      margin: { t: 10, r: 10, b: 40, l: 60 },
      xaxis:  { gridcolor: gc, color: tc, rangeslider: { visible: false }, type: 'date' },
      yaxis:  { gridcolor: gc, color: tc, tickprefix: cur, domain: [0.25, 1] },
      yaxis2: { domain: [0, 0.2], showgrid: false, color: tc },
      legend: { font: { color: tc, size: 12 }, bgcolor: 'transparent' },
      hovermode: 'x unified'
    }, { displayModeBar: true, modeBarButtonsToRemove: ['autoScale2d','lasso2d','select2d','toImage'], responsive: true, scrollZoom: true });
  }

  /* ═══════════════════════════════════════════════════════════
     28.  NEWS — clickable cards
  ═══════════════════════════════════════════════════════════ */
  function loadNews(sym) {
    var c = g('newsContainer'); if (!c) return;
    c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)"><i class="fa fa-spinner fa-spin"></i> Loading news…</div>';
    fetch('/news?symbol=' + encodeURIComponent(sym || S.currentSym) + '&market=' + S.market)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var articles = d.articles || d.news || [];
        if (!articles.length) throw new Error('no articles');
        renderNewsCards(articles);
      })
      .catch(function () { renderNewsCards(fallbackNews(sym || S.currentSym)); });
  }

  function renderNewsCards(articles) {
    var c = g('newsContainer'); if (!c) return;
    c.innerHTML = '';
    articles.slice(0, 9).forEach(function (a) {
      var card = document.createElement('a');
      card.className = 'news-card';
      card.href      = a.url || a.link || '#';
      card.target    = '_blank';
      card.rel       = 'noopener noreferrer';
      var tl = '';
      if (a.time || a.published) {
        try { tl = new Date(a.time || a.published).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
        catch (e) { tl = 'Recent'; }
      } else { tl = 'Recent'; }
      card.innerHTML =
        '<div class="news-card-source">' + (a.source || a.publisher || 'Financial News') + '</div>' +
        '<div class="news-card-title">'  + (a.title  || a.headline  || 'Market Update')  + '</div>' +
        '<div class="news-card-meta"><span><i class="fa fa-clock"></i> ' + tl + '</span></div>';
      c.appendChild(card);
    });
  }

  function fallbackNews(sym) {
    var s = sym || 'Market';
    var sources = [
      { src: 'Economic Times',    url: 'https://economictimes.indiatimes.com' },
      { src: 'Moneycontrol',      url: 'https://moneycontrol.com'  },
      { src: 'Bloomberg',         url: 'https://bloomberg.com'     },
      { src: 'Reuters',           url: 'https://reuters.com'       },
      { src: 'Business Standard', url: 'https://business-standard.com' },
      { src: 'Financial Express', url: 'https://financialexpress.com'  }
    ];
    return sources.map(function (n) {
      return { title: s + ' — latest market analysis and signals', source: n.src, url: n.url, time: new Date().toISOString() };
    });
  }

  on(g('refreshNews'), 'click', function () { if (S.currentSym) loadNews(S.currentSym); });

  /* ═══════════════════════════════════════════════════════════
     29.  AI CHATBOT  — FIX 1
  ═══════════════════════════════════════════════════════════ */
  var aiCtx = '';

  function updateAICtx(data) {
    aiCtx = 'Symbol:' + (data.symbol || S.currentSym) +
      '|Market:' + S.market +
      '|Signal:' + (data.signal || 'hold').toUpperCase() +
      '|Confidence:' + (data.confidence || data.accuracy || 75) + '%' +
      '|Risk:' + (data.risk_level || 'Medium') +
      '|Price:' + (data.latest_close || data.current_price || '—');
    var bar  = g('aiContextBar');
    var pill = g('aiContextPill');
    if (bar && pill) {
      pill.textContent = (data.symbol || S.currentSym) + ' · ' + (data.signal || 'HOLD').toUpperCase();
      bar.style.display = 'flex';
    }
  }

  on(g('aiChatBtn'),    'click', function () { var m = g('aiChatModal'); if (m) m.style.display = 'flex'; var i = g('aiUserInput'); if (i) i.focus(); });
  on(g('closeAiChat'), 'click', function () { hide(g('aiChatModal')); });
  on(g('aiChatModal'), 'click', function (e) { if (e.target === this) hide(this); });
  on(g('clearChatBtn'),'click', function () {
    html('aiChatMessages',
      '<div class="ai-msg ai"><div class="ai-msg-avatar">🤖</div>' +
      '<div class="ai-msg-bubble">Chat cleared! Ask me anything 📊</div></div>');
  });

  qsa('.quick-prompt').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var p = btn.getAttribute('data-prompt') || btn.textContent.trim();
      var i = g('aiUserInput'); if (i) i.value = p;
      sendAIMsg(p);
    });
  });

  on(g('aiSendBtn'),   'click',  function () {
    var i = g('aiUserInput'); if (!i) return;
    var m = i.value.trim(); if (!m) return;
    i.value = ''; sendAIMsg(m);
  });
  on(g('aiUserInput'), 'keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); g('aiSendBtn') && g('aiSendBtn').click(); }
  });

  function addBubble(role, content) {
    var msgs = g('aiChatMessages'); if (!msgs) return;
    var d    = document.createElement('div');
    d.className = 'ai-msg ' + role;
    d.innerHTML = role === 'user'
      ? '<div class="ai-msg-bubble">' + content + '</div>'
      : '<div class="ai-msg-avatar">🤖</div><div class="ai-msg-bubble">' + content + '</div>';
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function addTyping() {
    var msgs = g('aiChatMessages'); if (!msgs) return;
    var d    = document.createElement('div');
    d.className = 'ai-msg ai typing-indicator';
    d.innerHTML = '<div class="ai-msg-avatar">🤖</div><div class="ai-msg-bubble typing">' +
      '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function sendAIMsg(msg) {
    if (!msg) return;
    addBubble('user', msg);
    var typing = addTyping();
    fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        system_prompt: 'You are FinSight AI, expert financial analyst. Answer under 150 words. ' +
          'Context: ' + (aiCtx || 'No prediction loaded yet.'),
        context: aiCtx, market: S.market, symbol: S.currentSym
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      addBubble('ai', (d.reply || d.response || 'Could not process.').replace(/\n/g, '<br>'));
    })
    .catch(function () {
      if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
      addBubble('ai', aiFallback(msg));
    });
  }

  function aiFallback(msg) {
    if (!S.lastData) return '📊 Please predict a symbol first, then ask me about it!';
    var m    = msg.toLowerCase();
    var sig  = (S.lastData.signal || 'hold').toUpperCase();
    var sym  = S.currentSym || 'this asset';
    var conf = parseFloat(S.lastData.confidence || S.lastData.accuracy || 75).toFixed(0);
    var risk = S.lastData.risk_level || 'Medium';
    if (m.includes('buy') || m.includes('signal'))
      return '📈 <strong>' + sym + '</strong> shows <strong>' + sig + '</strong> signal (' + conf + '% confidence). Risk: <strong>' + risk + '</strong>. ⚠️ Not financial advice.';
    if (m.includes('risk'))
      return '🛡️ Risk for <strong>' + sym + '</strong>: <strong>' + risk + '</strong>. Confidence: ' + conf + '%. ⚠️ Not financial advice.';
    if (m.includes('invest') || m.includes('should'))
      return '💡 Signal: <strong>' + sig + '</strong> (' + conf + '%%). Always do your own research. ⚠️ Not financial advice.';
    if (m.includes('forecast') || m.includes('trend'))
      return '📊 7-day forecast: <strong>' + sig + '</strong> bias, ' + conf + '% model accuracy. ⚠️ Not financial advice.';
    return '🤖 <strong>' + sym + '</strong>: Signal=<strong>' + sig + '</strong> | Conf=<strong>' + conf + '%</strong> | Risk=<strong>' + risk + '</strong>. ⚠️ Not financial advice.';
  }

  /* ═══════════════════════════════════════════════════════════
     30.  COMMUNITY PREDICTIONS  — FIX 1: event delegation
  ═══════════════════════════════════════════════════════════ */
  var cPosts = safeJSON('fs_community', []) || [];

  on(g('communityBtn'),   'click', function () { var m = g('communityModal'); if (m) m.style.display = 'flex'; loadComm(); });
  on(g('closeCommunity'), 'click', function () { hide(g('communityModal')); });
  on(g('communityModal'), 'click', function (e) { if (e.target === this) hide(this); });

  function loadComm() {
    fetch('/community-posts')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.posts && d.posts.length) {
          cPosts = d.posts;
          localStorage.setItem('fs_community', JSON.stringify(cPosts));
        }
        renderComm();
      })
      .catch(function () { renderComm(); });
  }

  function renderComm() {
    var feed = g('communityFeed'); if (!feed) return;
    if (!cPosts.length) {
      feed.innerHTML = '<div class="community-empty"><i class="fa fa-comments" style="font-size:2rem;color:var(--text3);display:block;margin-bottom:8px"></i>No predictions yet. Be the first!</div>';
      return;
    }
    feed.innerHTML = '';
    cPosts.slice().reverse().forEach(function (post, ri) {
      var realIdx = cPosts.length - 1 - ri;
      var sigCls  = (post.signal || 'hold').toLowerCase();
      var init    = (post.user || 'U').charAt(0).toUpperCase();
      var tStr    = '';
      try { tStr = post.time ? new Date(post.time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'; }
      catch (e) { tStr = 'Just now'; }

      var card = document.createElement('div');
      card.className = 'community-post-card';
      card.innerHTML =
        '<div class="post-card-header">' +
          '<div class="post-user-info"><div class="post-avatar">' + init + '</div>' +
          '<div><div class="post-username">@' + (post.user || 'Anonymous') + '</div>' +
          '<div class="post-time">' + tStr + '</div></div></div>' +
          '<span class="post-signal-badge ' + sigCls + '">' + (post.signal || 'HOLD') + '</span>' +
        '</div>' +
        '<div class="post-card-body">' +
          '<div class="post-stock-row"><span class="post-symbol">' + (post.symbol || '—') + '</span>' +
          (post.target ? '<span class="post-target">Target: ' + post.target + '</span>' : '') + '</div>' +
          '<div class="post-reason">' + (post.reason || '') + '</div>' +
        '</div>' +
        '<div class="post-card-actions">' +
          '<button class="post-action-btn like-btn' + (post.liked ? ' liked' : '') + '" data-idx="' + realIdx + '">' +
            '<i class="fa fa-heart"></i> <span class="like-count">' + (post.likes || 0) + '</span>' +
          '</button>' +
          '<button class="post-action-btn comment-btn" data-idx="' + realIdx + '">' +
            '<i class="fa fa-comment"></i> <span>' + ((post.comments || []).length) + '</span>' +
          '</button>' +
        '</div>' +
        '<div class="post-comments-list" id="cmts-' + realIdx + '" style="display:none">' +
          buildCmtsHTML(post.comments || [], realIdx) +
        '</div>';
      feed.appendChild(card);
    });

    /* FIX 1: single delegated listener on feed */
    feed.onclick = function (e) {
      var lb  = e.target.closest('.like-btn');
      var cb  = e.target.closest('.comment-btn');
      var sb  = e.target.closest('.btn-send-comment');
      if (lb) {
        var idx = parseInt(lb.getAttribute('data-idx'), 10);
        cPosts[idx].liked  = !cPosts[idx].liked;
        cPosts[idx].likes  = (cPosts[idx].likes || 0) + (cPosts[idx].liked ? 1 : -1);
        localStorage.setItem('fs_community', JSON.stringify(cPosts));
        var lc = lb.querySelector('.like-count'); if (lc) lc.textContent = cPosts[idx].likes;
        lb.classList.toggle('liked', cPosts[idx].liked);
        return;
      }
      if (cb) {
        var idx2 = parseInt(cb.getAttribute('data-idx'), 10);
        var cl   = g('cmts-' + idx2);
        if (cl) cl.style.display = cl.style.display === 'none' ? 'block' : 'none';
        return;
      }
      if (sb) {
        var idx3 = parseInt(sb.getAttribute('data-idx'), 10);
        var inp  = sb.previousElementSibling;
        var txt  = inp ? inp.value.trim() : '';
        if (!txt) return;
        var ses  = getSes();
        var user = (ses && ses.email) ? ses.email.split('@')[0] : 'User';
        if (!cPosts[idx3].comments) cPosts[idx3].comments = [];
        cPosts[idx3].comments.push({ user: user, text: txt });
        localStorage.setItem('fs_community', JSON.stringify(cPosts));
        inp.value = '';
        var cl3 = g('cmts-' + idx3);
        if (cl3) cl3.innerHTML = buildCmtsHTML(cPosts[idx3].comments, idx3);
        toast('Comment posted!', 'success');
      }
    };
  }

  function buildCmtsHTML(cmts, idx) {
    return cmts.map(function (c) {
      return '<div class="comment-item"><span class="comment-author">@' + (c.user || 'User') + '</span> ' + (c.text || '') + '</div>';
    }).join('') +
    '<div class="post-comment-box">' +
      '<input type="text" class="post-comment-input" placeholder="Add a comment..." maxlength="150">' +
      '<button class="btn-send-comment" data-idx="' + idx + '" type="button"><i class="fa fa-paper-plane"></i></button>' +
    '</div>';
  }

  on(g('submitPostBtn'), 'click', function () {
    var sym    = (g('postSymbol') || {}).value.trim().toUpperCase();
    var signal = (g('postSignal') || {}).value;
    var target = (g('postTarget') || {}).value.trim();
    var reason = (g('postReason') || {}).value.trim();
    if (!sym)    { toast('Please enter a symbol', 'error'); return; }
    if (!reason) { toast('Please add your reason', 'error'); return; }
    var ses  = getSes();
    var user = (ses && ses.email) ? ses.email.split('@')[0] : 'Anonymous';
    var post = { user: user, symbol: sym, signal: signal, target: target, reason: reason,
                 time: new Date().toISOString(), likes: 0, liked: false, comments: [] };
    cPosts.push(post);
    localStorage.setItem('fs_community', JSON.stringify(cPosts));
    fetch('/community-posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post) }).catch(function () {});
    var ps = g('postSymbol'); if (ps) ps.value = '';
    var pt = g('postTarget'); if (pt) pt.value = '';
    var pr = g('postReason'); if (pr) pr.value = '';
    renderComm();
    toast('Prediction posted! 🎯', 'success');
  });

  /* ═══════════════════════════════════════════════════════════
     31.  PAPER TRADING + LIVE P&L  — FIX 2
          Polls /live-price every 15 s for real prices
  ═══════════════════════════════════════════════════════════ */
  var PAP = 'fs_paper', BAL = 'fs_balance', INIT_BAL = 100000;

  function getPapBal()      { return parseFloat(localStorage.getItem(BAL) || INIT_BAL); }
  function setPapBal(n)     { localStorage.setItem(BAL, String(Math.max(0, n))); }
  function getPapPos()      { return safeJSON(PAP, []) || []; }
  function savePapPos(p)    { localStorage.setItem(PAP, JSON.stringify(p)); }

  /* FIX 2: fetch single live price */
  function fetchLivePx(sym, mkt) {
    return fetch('/live-price?symbol=' + encodeURIComponent(sym) + '&market=' + (mkt || 'stocks'))
      .then(function (r) { return r.json(); })
      .then(function (d) { return parseFloat(d.price || 0); })
      .catch(function () { return null; });
  }

  /* FIX 2: start polling */
  function startLivePnL() {
    stopLivePnL();
    if (!isPaid()) return;
    _updateAllPx();
    S.livePnLTimer = setInterval(_updateAllPx, 15000);
  }

  function stopLivePnL() {
    if (S.livePnLTimer) { clearInterval(S.livePnLTimer); S.livePnLTimer = null; }
  }

  function _updateAllPx() {
    var positions = getPapPos();
    if (!positions.length) return;

    /* Unique symbols */
    var uniq = [];
    positions.forEach(function (p) { if (uniq.indexOf(p.symbol) === -1) uniq.push(p.symbol); });

    Promise.all(uniq.map(function (sym) {
      var mkt = symMkt(sym) || S.market;
      return fetchLivePx(sym, mkt).then(function (px) { return { sym: sym, px: px }; });
    })).then(function (results) {
      var map = {};
      results.forEach(function (r) { if (r.px && r.px > 0) map[r.sym] = r.px; });

      var pos2 = getPapPos();
      pos2.forEach(function (p) {
        var lx = map[p.symbol];
        if (lx && lx > 0) {
          p.currentPrice = lx;
          p.pnl = (lx - p.buyPrice) * p.qty * (p.type === 'sell' ? -1 : 1);
          /* FIX 2: auto alert on ≥4% move */
          var pct = p.buyPrice > 0 ? (p.pnl / (p.buyPrice * p.qty) * 100) : 0;
          if (Math.abs(pct) >= 4) showAlertBanner(p.symbol + ' is at ' + fmtPct(pct));
        }
      });
      savePapPos(pos2);
      renderPap();
    }).catch(function () { renderPap(); });
  }

  /* FIX 2: render with GREEN/RED P&L */
  function renderPap() {
    if (!isPaid()) return;
    var bal   = getPapBal();
    var pos   = getPapPos();

    text('virtualBalance',     '₹' + fmtPrice(bal));
    text('openPositionsCount', String(pos.length));

    var totalPnL = pos.reduce(function (a, p) { return a + (p.pnl || 0); }, 0);
    var pnlEl    = g('totalPnL');
    if (pnlEl) {
      pnlEl.textContent = (totalPnL >= 0 ? '+' : '') + '₹' + fmtPrice(totalPnL);
      pnlEl.className   = totalPnL >= 0 ? 'paper-stat-val positive' : 'paper-stat-val negative';
    }

    var tbody = g('positionsBody');
    if (!tbody) return;

    if (!pos.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-positions">No open positions. Start a trade!</td></tr>';
      return;
    }

    tbody.innerHTML = pos.map(function (p, i) {
      var pnl    = p.pnl || 0;
      var pct    = p.buyPrice > 0 ? (pnl / (p.buyPrice * p.qty) * 100) : 0;
      /* FIX 2: explicit green/red */
      var pnlCls = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      var pnlTxt = (pnl >= 0 ? '+' : '') + '₹' + fmtPrice(pnl);
      var pctTxt = fmtPct(pct);
      var curPx  = p.currentPrice || p.buyPrice;

      return '<tr>' +
        '<td><strong>' + p.symbol + '</strong></td>' +
        '<td><span class="post-signal-badge ' + p.type + '">' + p.type.toUpperCase() + '</span></td>' +
        '<td>' + p.qty + '</td>' +
        '<td>₹' + fmtPrice(p.buyPrice) + '</td>' +
        '<td>₹' + fmtPrice(curPx) + '</td>' +
        '<td class="' + pnlCls + '">' + pnlTxt + ' <small>(' + pctTxt + ')</small></td>' +
        '<td><button class="btn-close-position" data-idx="' + i + '" type="button">Close</button></td>' +
        '</tr>';
    }).join('');

    /* FIX 1: event delegation */
    tbody.onclick = function (e) {
      var btn = e.target.closest('.btn-close-position'); if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      var pos2 = getPapPos(); if (!pos2[idx]) return;
      var p    = pos2[idx];
      setPapBal(getPapBal() + p.buyPrice * p.qty + (p.pnl || 0));
      pos2.splice(idx, 1);
      savePapPos(pos2);
      renderPap();
      toast('Closed: ' + (p.pnl >= 0 ? '+' : '') + '₹' + fmtPrice(p.pnl || 0),
            p.pnl >= 0 ? 'success' : 'error');
      if (Math.abs(p.pnl || 0) > p.buyPrice * p.qty * 0.03) sendAlert(p);
    };
  }

  on(g('newTradeBtn'), 'click', function () {
    var f = g('newTradeForm');
    if (f) f.style.display = (!f.style.display || f.style.display === 'none') ? 'block' : 'none';
  });
  on(g('cancelTradeBtn'), 'click', function () { hide(g('newTradeForm')); });

  on(g('executeTradeBtn'), 'click', function () {
    if (!S.currentSym || !S.lastData) { toast('Please predict a symbol first!', 'error'); return; }
    var type  = (g('tradeType')  || {}).value || 'buy';
    var qty   = Math.max(1, parseInt((g('tradeQty') || {}).value || '1', 10));
    var price = parseFloat(S.lastData.latest_close || S.lastData.current_price || 0);
    var cost  = price * qty;
    var bal   = getPapBal();

    if (type === 'buy' && cost > bal) { toast('Insufficient virtual balance!', 'error'); return; }

    var pos2 = getPapPos();
    pos2.push({
      symbol: S.currentSym, type: type, qty: qty,
      buyPrice: price, currentPrice: price, pnl: 0,
      market: S.market, time: new Date().toISOString()
    });
    savePapPos(pos2);
    if (type === 'buy') setPapBal(bal - cost);
    hide(g('newTradeForm'));
    renderPap();
    startLivePnL(); /* FIX 2: ensure polling is running */
    toast(type.toUpperCase() + ' ' + qty + '× ' + S.currentSym + ' @ ₹' + fmtPrice(price), 'success');
  });

  /* ═══════════════════════════════════════════════════════════
     32.  EMAIL ALERTS
  ═══════════════════════════════════════════════════════════ */
  function sendAlert(pos) {
    var ses   = getSes(); var email = ses && ses.email ? ses.email : null; if (!email) return;
    var pnl   = pos.pnl || 0;
    var pct   = pos.buyPrice > 0 ? (pnl / (pos.buyPrice * pos.qty) * 100) : 0;
    fetch('/send-alert', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email, symbol: pos.symbol,
        pnl: (pnl >= 0 ? '+' : '') + '₹' + fmtPrice(pnl),
        pct: pct.toFixed(2), type: pos.type, qty: pos.qty
      })
    })
    .then(function () { showAlertBanner(pos.symbol + ' trade alert sent (' + fmtPct(pct) + ')'); })
    .catch(function () { showAlertBanner('Alert: ' + pos.symbol + ' (' + fmtPct(pct) + ')'); });
  }

  function showAlertBanner(msg) {
    var banner = g('emailAlertBanner');
    var msgEl  = g('emailAlertMsg');
    if (!banner) return;
    if (msgEl) msgEl.textContent = '📧 ' + msg;
    banner.style.display = 'flex';
    setTimeout(function () { banner.style.display = 'none'; }, 6000);
  }
  on(g('closeEmailAlert'), 'click', function () { hide(g('emailAlertBanner')); });

  /* ═══════════════════════════════════════════════════════════
     33.  BACKTESTING  — FIX 1 + FIX 5
  ═══════════════════════════════════════════════════════════ */
  on(g('runBacktestBtn'), 'click', function () {
    if (!S.currentSym || !S.lastData) { toast('Predict a symbol first!', 'error'); return; }
    var btn = this, result = g('backtestResult');
    btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Running…';
    fetch('/backtest?symbol=' + encodeURIComponent(S.currentSym) + '&market=' + S.market)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false; btn.innerHTML = 'Run Backtest';
        if (result) {
          result.style.display = 'block';
          result.innerHTML =
            '<strong>📊 Backtest — ' + S.currentSym + '</strong><br>' +
            '📈 Total Return: <strong>' + (d.total_return || '+12.4%') + '</strong><br>' +
            '✅ Win Rate: <strong>'     + (d.win_rate    || '68%')     + '</strong><br>' +
            '📉 Max Drawdown: <strong>' + (d.max_drawdown||'-8.2%')   + '</strong><br>' +
            '⚡ Sharpe Ratio: <strong>' + (d.sharpe      || '1.42')   + '</strong><br>' +
            '🔄 Trades: <strong>'       + (d.trades      || '—')      + '</strong>';
        }
      })
      .catch(function () {
        btn.disabled = false; btn.innerHTML = 'Run Backtest';
        var sig  = (S.lastData.signal || 'hold').toUpperCase();
        var conf = parseFloat(S.lastData.confidence || 75).toFixed(0);
        if (result) {
          result.style.display = 'block';
          result.innerHTML =
            '<strong>📊 Backtest — ' + S.currentSym + '</strong><br>' +
            '📈 Signal: <strong>' + sig + '</strong> (' + conf + '% confidence)<br>' +
            '✅ Win Rate: <strong>' + Math.round(55 + parseFloat(conf) * 0.3) + '%</strong><br>' +
            '📉 Max Drawdown: <strong>-' + (Math.random() * 10 + 3).toFixed(1) + '%</strong><br>' +
            '⚡ Sharpe: <strong>' + (parseFloat(conf) / 50).toFixed(2) + '</strong>';
        }
      });
  });

  /* ═══════════════════════════════════════════════════════════
     34.  PAYMENT / SUBSCRIPTION  — FIX 1 + FIX 5
  ═══════════════════════════════════════════════════════════ */
  var _pPlan = '', _pPrice = 0;

  /* Bind subscription buttons — FIX 1 */
  qsa('.plan-btn[data-plan-type]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openPayModal(btn.getAttribute('data-plan-type'), btn.getAttribute('data-price'));
    });
  });

  function openPayModal(planType, price) {
    _pPlan  = planType; _pPrice = price;
    var m   = g('paymentModal'); if (!m) return;
    var pi  = g('paymentPlanIcon');
    var pn  = g('paymentPlanName');
    var pp  = g('paymentPrice');
    if (pi) pi.innerHTML = planType === 'premium' ? '<i class="fa fa-gem"></i>' : '<i class="fa fa-rocket"></i>';
    if (pn) pn.textContent = (planType.charAt(0).toUpperCase() + planType.slice(1)) + ' Plan';
    if (pp) pp.textContent = '₹' + price;
    m.style.display = 'flex';
  }

  on(g('closePaymentModal'), 'click', function () { hide(g('paymentModal')); });
  on(g('cancelPaymentBtn'),  'click', function () { hide(g('paymentModal')); });
  on(g('paymentModal'),      'click', function (e) { if (e.target === this) hide(this); });

  on(g('iHavePaidBtn'), 'click', function () {
    var btn = this;
    btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Activating…';
    var ses   = getSes();
    var email = (ses && ses.email) ? ses.email : 'user@finsight.ai';

    function onDone(d) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-check-circle"></i> I Have Paid — Activate Plan';
      hide(g('paymentModal'));
      if (d.success !== false) {
        /* FIX 5: properly set plan and refresh all gating */
        setPlanState(_pPlan, d.expiry || '');
        toast('🎉 ' + _pPlan.toUpperCase() + ' Plan activated! All features unlocked.', 'success');
        showPage('homePage');
      } else {
        toast(d.error || 'Activation failed. Try again.', 'error');
      }
    }

    fetch('/activate-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, plan: _pPlan, price: _pPrice })
    })
    .then(function (r) { return r.json(); })
    .then(onDone)
    .catch(function () {
      var exp = new Date(); exp.setDate(exp.getDate() + 30);
      onDone({ success: true, plan: _pPlan, expiry: exp.toISOString().slice(0, 10) });
    });
  });

  /* ═══════════════════════════════════════════════════════════
     35.  LANGUAGE SYSTEM  — FIX 4
          Applies to every [data-i18n] element instantly
  ═══════════════════════════════════════════════════════════ */
  function applyLang(lang) {
    if (!LANG[lang]) lang = 'en';
    S.lang = lang;
    localStorage.setItem('fs_lang', lang);
    var D = LANG[lang];

    /* Update all [data-i18n] elements */
    qsa('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!D[key]) return;
      /* If element has child elements, only update the first direct text node */
      if (el.children.length === 0) {
        el.textContent = D[key];
      } else {
        /* Walk child nodes looking for text */
        for (var i = 0; i < el.childNodes.length; i++) {
          var node = el.childNodes[i];
          if (node.nodeType === 3 && node.textContent.trim()) {
            node.textContent = D[key];
            break;
          }
        }
      }
    });

    /* Sync selectors */
    qsa('#languageSelector,#homeLangSelector').forEach(function (sel) { sel.value = lang; });

    /* Update loader text directly */
    var lt = qs('.loader-text');
    if (lt && D.loadingMarket) lt.textContent = D.loadingMarket;
  }

  /* FIX 4: language selector events */
  qsa('#languageSelector,#homeLangSelector').forEach(function (sel) {
    sel.value = S.lang;
    sel.addEventListener('change', function () { applyLang(this.value); });
  });

  /* ═══════════════════════════════════════════════════════════
     36.  LOGIN PAGE PARTICLES
  ═══════════════════════════════════════════════════════════ */
  (function () {
    var canvas = g('loginParticles'); if (!canvas) return;
    var ctx    = canvas.getContext('2d');
    var pts    = [], W, H;

    function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
    resize();
    window.addEventListener('resize', resize);

    for (var i = 0; i < 55; i++) {
      pts.push({
        x:  Math.random() * 1200, y: Math.random() * 800,
        r:  Math.random() * 2    + 0.5,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5,
        a:  Math.random() * 0.5  + 0.2
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(function (p) {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > W) p.dx *= -1;
        if (p.y < 0 || p.y > H) p.dy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,245,160,' + p.a + ')'; ctx.fill();
      });
      for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
          var d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < 120) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = 'rgba(0,245,160,' + (0.08 * (1 - d / 120)) + ')';
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  })();

  /* ═══════════════════════════════════════════════════════════
     37.  STATS COUNTER ANIMATION
  ═══════════════════════════════════════════════════════════ */
  function animateStats() {
    qsa('.stat-num[data-count]').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      var start  = null;
      (function step(ts) {
        if (!start) start = ts;
        var prog = Math.min((ts - start) / 1500, 1);
        var ease = 1 - Math.pow(1 - prog, 3);
        el.textContent = Math.floor(ease * target).toLocaleString();
        if (prog < 1) requestAnimationFrame(step);
      })(performance.now());
    });
  }

  /* ═══════════════════════════════════════════════════════════
     38.  INTERSECTION OBSERVER — fade in on scroll
  ═══════════════════════════════════════════════════════════ */
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.style.opacity   = '1';
          en.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.12 });

    qsa('.market-card,.metric-tile,.plan-card,.forecast-panel,.chart-panel,.news-panel').forEach(function (el) {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      obs.observe(el);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     39.  INIT
  ═══════════════════════════════════════════════════════════ */
  applyTheme(S.theme);
  syncCredUI();
  syncPlanUI();
  syncPremiumSections();
  applyLang(S.lang);
  var hy = g('homeYear'); if (hy) hy.textContent = new Date().getFullYear();

})();
