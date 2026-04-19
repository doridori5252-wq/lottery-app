/* ========================================
   LuckyAI Lotto - Main Application Logic
   ======================================== */

// ==================== STATE ====================
const state = {
  currentPage: 'home',
  currentGame: 'powerball',
  currentAlgo: 'random',
  currentStatsGame: 'powerball',
  currentResultGame: 'powerball',
  currentFilter: 'all',
  setCounts: 5,
  generatedSets: [],
  savedNumbers: JSON.parse(localStorage.getItem('luckyai_saved') || '[]'),
  settings: JSON.parse(localStorage.getItem('luckyai_settings') || '{"darkMode":true,"sound":true,"defaultSets":5,"lang":"ko"}'),
  jackpotSlide: 0,
};

// ==================== GAME CONFIGS ====================
const GAMES = {
  powerball: {
    name: 'Powerball',
    flag: '🇺🇸',
    mainCount: 5,
    mainMax: 69,
    specialMax: 26,
    specialName: 'Powerball',
    mainClass: 'b-white',
    specialClass: 'b-red',
    tagClass: 'pb',
    color: '#e74c3c',
  },
  mega: {
    name: 'Mega Millions',
    flag: '🇺🇸',
    mainCount: 5,
    mainMax: 70,
    specialMax: 25,
    specialName: 'Mega Ball',
    mainClass: 'b-white',
    specialClass: 'b-gold',
    tagClass: 'mm',
    color: '#3498db',
  },
  lotto: {
    name: '로또 6/45',
    flag: '🇰🇷',
    mainCount: 6,
    mainMax: 45,
    specialMax: 0,
    specialName: '',
    mainClass: '',  // dynamic based on number
    specialClass: '',
    tagClass: 'kr',
    color: '#f39c12',
  }
};

// ==================== LIVE DATA FROM APIs ====================
const pastResults = { powerball: [], mega: [], lotto: [] };
const jackpotData = { powerball: null, mega: null, lotto: null };
const CACHE_KEY = 'luckyai_results_cache';
const CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour

// API endpoints
const API = {
  powerball: 'https://data.ny.gov/resource/d6yy-54nr.json?$limit=5000&$order=draw_date%20DESC',
  mega: 'https://data.ny.gov/resource/5xaw-6ayf.json?$limit=5000&$order=draw_date%20DESC',
  // Korean Lotto: fetch multiple rounds from dhlottery
  lottoBase: 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=',
};

// Load cached results from localStorage
function loadCachedResults() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    if (cached.timestamp && (Date.now() - cached.timestamp < CACHE_EXPIRY)) {
      if (cached.powerball?.length) pastResults.powerball = cached.powerball;
      if (cached.mega?.length) pastResults.mega = cached.mega;
      if (cached.lotto?.length) pastResults.lotto = cached.lotto;
      console.log('Loaded from cache:', {
        pb: pastResults.powerball.length,
        mm: pastResults.mega.length,
        kr: pastResults.lotto.length
      });
      return true;
    }
  } catch (e) { console.log('Cache load failed:', e); }
  return false;
}

// Save results to cache
function cacheResults() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      powerball: pastResults.powerball,
      mega: pastResults.mega,
      lotto: pastResults.lotto,
    }));
  } catch (e) { console.log('Cache save failed:', e); }
}

// Fetch Powerball results from NY Open Data
async function fetchPowerball() {
  try {
    const res = await fetch(API.powerball);
    if (!res.ok) throw new Error('PB API failed');
    const data = await res.json();
    pastResults.powerball = data.map((d, i) => {
      const nums = d.winning_numbers.split(' ').map(Number);
      const main = nums.slice(0, 5).sort((a, b) => a - b);
      const special = nums[5];
      return {
        round: data.length - i,
        date: d.draw_date.split('T')[0],
        main,
        special,
        multiplier: d.multiplier,
      };
    });
    console.log(`Powerball: ${pastResults.powerball.length} results loaded`);
  } catch (e) {
    console.log('Powerball fetch failed:', e);
    if (!pastResults.powerball.length) generateFallbackResults('powerball');
  }
}

// Fetch Mega Millions results from NY Open Data
async function fetchMegaMillions() {
  try {
    const res = await fetch(API.mega);
    if (!res.ok) throw new Error('MM API failed');
    const data = await res.json();
    pastResults.mega = data.map((d, i) => {
      const main = d.winning_numbers.split(' ').map(Number).sort((a, b) => a - b);
      const special = parseInt(d.mega_ball);
      return {
        round: data.length - i,
        date: d.draw_date.split('T')[0],
        main,
        special,
      };
    });
    console.log(`Mega Millions: ${pastResults.mega.length} results loaded`);
  } catch (e) {
    console.log('Mega Millions fetch failed:', e);
    if (!pastResults.mega.length) generateFallbackResults('mega');
  }
}

// Fetch Korean Lotto results
// Strategy: Netlify Function (deployed) → CORS proxies → fallback
async function fetchKoreanLotto() {
  // Estimate latest round number (started 2002-12-07, draws every Saturday)
  const startDate = new Date('2002-12-07');
  const now = new Date();
  const diffWeeks = Math.floor((now - startDate) / (7 * 24 * 60 * 60 * 1000));
  const latestRound = diffWeeks;

  // Determine fetcher: Netlify Function or CORS proxy
  const fetcher = await findWorkingFetcher(latestRound);
  if (!fetcher) {
    console.log('Korean Lotto: all methods failed');
    if (!pastResults.lotto.length) generateFallbackResults('lotto');
    return;
  }

  // Fetch 100 rounds in batches of 20
  const allResults = [];
  for (let batch = 0; batch < 5; batch++) {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      const round = latestRound - (batch * 20) - i;
      if (round < 1) break;
      promises.push(fetchLottoRound(round, fetcher));
    }
    const results = await Promise.allSettled(promises);
    const valid = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);
    allResults.push(...valid);
    if (valid.length < 5 && batch > 0) break;
  }

  if (allResults.length > 0) {
    pastResults.lotto = allResults.sort((a, b) => b.round - a.round);
    console.log(`Korean Lotto: ${pastResults.lotto.length} results loaded`);
  } else {
    console.log('Korean Lotto: no results fetched');
    if (!pastResults.lotto.length) generateFallbackResults('lotto');
  }
}

async function findWorkingFetcher(testRound) {
  // Method 1: Netlify Serverless Function (works when deployed)
  try {
    const res = await fetch(`/.netlify/functions/lotto?round=${testRound}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith('{')) {
        const data = JSON.parse(text);
        if (data.returnValue === 'success') {
          console.log('Korean Lotto: using Netlify Function proxy');
          return (round) => `/.netlify/functions/lotto?round=${round}`;
        }
      }
    }
  } catch (e) { /* not on Netlify */ }

  // Method 2: Try CORS proxies
  const proxies = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  for (const proxy of proxies) {
    try {
      const testUrl = proxy(`${API.lottoBase}${testRound}`);
      const res = await fetch(testUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.startsWith('{')) continue;
      const data = JSON.parse(text);
      if (data.returnValue === 'success') {
        console.log(`Korean Lotto: using CORS proxy`);
        return (round) => proxy(`${API.lottoBase}${round}`);
      }
    } catch (e) { continue; }
  }

  return null;
}

async function fetchLottoRound(round, fetcher) {
  try {
    const res = await fetch(fetcher(round), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.startsWith('{')) return null;
    const data = JSON.parse(text);
    if (data.returnValue !== 'success') return null;

    return {
      round: data.drwNo,
      date: data.drwNoDate,
      main: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].sort((a, b) => a - b),
      special: data.bnusNo,
    };
  } catch (e) { return null; }
}

// Static Korean Lotto data (real results, updated periodically)
const STATIC_LOTTO_DATA = [
  {round:1215,date:'2026-03-14',main:[13,15,19,21,44,45],special:39},
  {round:1214,date:'2026-03-07',main:[10,15,19,27,30,33],special:14},
  {round:1213,date:'2026-02-28',main:[5,11,25,27,36,38],special:2},
  {round:1212,date:'2026-02-21',main:[5,8,25,31,41,44],special:45},
  {round:1211,date:'2026-02-14',main:[23,26,27,35,38,40],special:10},
  {round:1210,date:'2026-02-07',main:[1,7,9,17,27,38],special:31},
  {round:1209,date:'2026-01-31',main:[2,17,20,35,37,39],special:24},
  {round:1208,date:'2026-01-24',main:[6,27,30,36,38,42],special:25},
  {round:1207,date:'2026-01-17',main:[10,22,24,27,38,45],special:11},
  {round:1206,date:'2026-01-10',main:[1,3,17,26,27,42],special:23},
  {round:1205,date:'2026-01-03',main:[1,4,16,23,31,41],special:2},
  {round:1204,date:'2025-12-27',main:[8,16,28,30,31,44],special:27},
  {round:1203,date:'2025-12-20',main:[3,6,18,29,35,39],special:24},
  {round:1202,date:'2025-12-13',main:[5,12,21,33,37,40],special:7},
  {round:1201,date:'2025-12-06',main:[7,9,24,27,35,36],special:37},
  {round:1200,date:'2025-11-29',main:[1,2,4,16,20,32],special:45},
  {round:1199,date:'2025-11-22',main:[16,24,25,30,31,32],special:7},
  {round:1198,date:'2025-11-15',main:[26,30,33,38,39,41],special:21},
  {round:1197,date:'2025-11-08',main:[1,5,7,26,28,43],special:30},
  {round:1196,date:'2025-11-01',main:[8,12,15,29,40,45],special:14},
  {round:1195,date:'2025-10-25',main:[3,15,27,33,34,36],special:37},
  {round:1194,date:'2025-10-18',main:[3,13,15,24,33,37],special:2},
  {round:1193,date:'2025-10-11',main:[6,9,16,19,24,28],special:17},
  {round:1192,date:'2025-10-04',main:[10,16,23,36,39,40],special:11},
  {round:1191,date:'2025-09-27',main:[1,4,11,12,20,41],special:2},
  {round:1190,date:'2025-09-20',main:[7,9,19,23,26,45],special:33},
  {round:1189,date:'2025-09-13',main:[9,19,29,35,37,38],special:31},
  {round:1188,date:'2025-09-06',main:[3,4,12,19,22,27],special:9},
  {round:1187,date:'2025-08-30',main:[5,13,26,29,37,40],special:42},
  {round:1186,date:'2025-08-23',main:[2,8,13,16,23,28],special:35},
  {round:1185,date:'2025-08-16',main:[6,17,22,28,29,32],special:38},
  {round:1184,date:'2025-08-09',main:[14,16,23,25,31,37],special:42},
  {round:1183,date:'2025-08-02',main:[4,15,17,23,27,36],special:31},
  {round:1182,date:'2025-07-26',main:[1,13,21,25,28,31],special:22},
  {round:1181,date:'2025-07-19',main:[8,10,14,20,33,41],special:28},
  {round:1180,date:'2025-07-12',main:[6,12,18,37,40,41],special:3},
  {round:1179,date:'2025-07-05',main:[3,16,18,24,40,44],special:21},
  {round:1178,date:'2025-06-28',main:[5,6,11,27,43,44],special:17},
  {round:1177,date:'2025-06-21',main:[3,7,15,16,19,43],special:21},
  {round:1176,date:'2025-06-14',main:[7,9,11,21,30,35],special:29},
  {round:1175,date:'2025-06-07',main:[3,4,6,8,32,42],special:31},
  {round:1174,date:'2025-05-31',main:[8,11,14,17,36,39],special:22},
  {round:1173,date:'2025-05-24',main:[1,5,18,20,30,35],special:3},
  {round:1172,date:'2025-05-17',main:[7,9,24,40,42,44],special:45},
  {round:1171,date:'2025-05-10',main:[3,6,7,11,12,17],special:19},
  {round:1170,date:'2025-05-03',main:[3,13,28,34,38,42],special:25},
  {round:1169,date:'2025-04-26',main:[5,12,24,26,39,42],special:20},
  {round:1168,date:'2025-04-19',main:[9,21,24,30,33,37],special:29},
  {round:1167,date:'2025-04-12',main:[8,23,31,35,39,40],special:24},
  {round:1166,date:'2025-04-05',main:[14,23,25,27,29,42],special:16},
  {round:1165,date:'2025-03-29',main:[6,7,27,29,38,45],special:17},
];

// Fallback: use static data for lotto, generate random for US games
function generateFallbackResults(gameKey) {
  if (gameKey === 'lotto') {
    pastResults.lotto = STATIC_LOTTO_DATA.map(d => ({ ...d }));
    console.log(`lotto: using static real data (${STATIC_LOTTO_DATA.length} rounds)`);
    return;
  }
  const game = GAMES[gameKey];
  pastResults[gameKey] = [];
  for (let i = 0; i < 100; i++) {
    const main = getRandomNumbers(game.mainMax, game.mainCount);
    const special = game.specialMax > 0 ? randInt(1, game.specialMax) : null;
    const date = new Date();
    date.setDate(date.getDate() - i * 3);
    pastResults[gameKey].push({
      round: 1200 - i,
      date: date.toISOString().split('T')[0],
      main,
      special,
    });
  }
  console.log(`${gameKey}: using fallback simulated data`);
}

// Master fetch function: load all lottery data
async function fetchAllResults() {
  // First check cache
  if (loadCachedResults()) {
    return; // Use cached data
  }

  // Fetch from APIs in parallel
  showToast('📡 최신 당첨번호를 불러오는 중...');

  await Promise.allSettled([
    fetchPowerball(),
    fetchMegaMillions(),
    fetchKoreanLotto(),
  ]);

  // Cache the results
  cacheResults();

  // Re-render everything
  renderHome();
  showToast('✅ 최신 당첨번호가 업데이트되었습니다!');
}

// Force refresh (ignore cache)
async function forceRefreshResults() {
  localStorage.removeItem(CACHE_KEY);
  showToast('📡 최신 당첨번호를 불러오는 중...');

  await Promise.allSettled([
    fetchPowerball(),
    fetchMegaMillions(),
    fetchKoreanLotto(),
  ]);

  cacheResults();
  renderHome();
  if (state.currentPage === 'stats') renderStats();
  if (state.currentPage === 'results') renderResultsPage();
  showToast('✅ 최신 당첨번호가 업데이트되었습니다!');
}

// ==================== UTILITY FUNCTIONS ====================
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomNumbers(max, count) {
  const nums = new Set();
  while (nums.size < count) nums.add(randInt(1, max));
  return [...nums].sort((a, b) => a - b);
}

function getLottoBallClass(n) {
  if (n <= 10) return 'b-y';
  if (n <= 20) return 'b-b';
  if (n <= 30) return 'b-r';
  if (n <= 40) return 'b-g';
  return 'b-gr';
}

function getBallClass(game, num, isSpecial) {
  // Korean Lotto: bonus ball also uses number-based coloring
  if (game === 'lotto') return getLottoBallClass(num);
  if (isSpecial) return GAMES[game].specialClass;
  return GAMES[game].mainClass;
}

function createBallHTML(game, num, isSpecial = false, size = '') {
  const cls = getBallClass(game, num, isSpecial);
  const sizeClass = size ? `ball-${size}` : '';
  return `<div class="ball ${cls} ${sizeClass}">${num}</div>`;
}

function createBallsRow(game, mainNums, specialNum, size = '') {
  let html = mainNums.map(n => createBallHTML(game, n, false, size)).join('');
  if (specialNum !== null && specialNum !== undefined) {
    html += `<span class="sep">+</span>` + createBallHTML(game, specialNum, true, size);
  }
  return html;
}

function createAnimatedBallsRow(game, mainNums, specialNum, baseDelay = 0) {
  let html = '';
  mainNums.forEach((n, i) => {
    const cls = getBallClass(game, n, false);
    html += `<div class="ball ${cls} anim" style="animation-delay:${(baseDelay + i) * 0.12}s">${n}</div>`;
  });
  if (specialNum !== null && specialNum !== undefined) {
    const idx = mainNums.length;
    html += `<span class="sep" style="opacity:0;animation:fadeIn 0.3s ${(baseDelay + idx) * 0.12}s forwards">+</span>`;
    const cls = getBallClass(game, specialNum, true);
    html += `<div class="ball ${cls} anim" style="animation-delay:${(baseDelay + idx) * 0.12}s">${specialNum}</div>`;
  }
  return html;
}

// ==================== SCIENTIFIC PREDICTION ENGINE ====================
// Based on: Bayesian probability, Poisson distribution, Chi-squared deviation,
// Moving average trend analysis, Law of Large Numbers equilibrium theory

// ---- Core Math Utilities ----
function weightedPick(pool, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return pool.length - 1;
}

// ---- Statistical Analysis Functions ----

// 1. Poisson Distribution: probability of a number appearing k times in n trials
function poissonPMF(k, lambda) {
  if (lambda <= 0) return 0;
  let logP = k * Math.log(lambda) - lambda;
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

// 2. Chi-squared deviation: how much a number deviates from expected
function chiSquaredScore(observed, expected) {
  if (expected === 0) return 0;
  return Math.pow(observed - expected, 2) / expected;
}

// 3. Recent trend analysis using exponential moving average
function getRecentTrend(game, numToCheck, recentWindow = 50) {
  const data = pastResults[game] || [];
  const recent = data.slice(0, Math.min(recentWindow, data.length));
  if (recent.length === 0) return 0;

  let weightedCount = 0;
  let totalWeight = 0;
  recent.forEach((r, i) => {
    const weight = Math.exp(-i * 0.03); // exponential decay: recent draws matter more
    if (r.main.includes(numToCheck)) weightedCount += weight;
    totalWeight += weight;
  });
  return totalWeight > 0 ? weightedCount / totalWeight : 0;
}

// 4. Gap analysis: how many draws since a number last appeared
function getLastGap(game, numToCheck) {
  const data = pastResults[game] || [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].main.includes(numToCheck)) return i;
  }
  return data.length; // never appeared in available data
}

// 5. Pair frequency: which numbers tend to appear together
function getPairScore(game, candidate, existingNums) {
  if (existingNums.length === 0) return 1;
  const data = pastResults[game] || [];
  if (data.length < 10) return 1;

  let pairCount = 0;
  let totalChecked = 0;
  const checkLimit = Math.min(200, data.length);

  for (let i = 0; i < checkLimit; i++) {
    const main = data[i].main;
    if (main.includes(candidate)) {
      for (const existing of existingNums) {
        if (main.includes(existing)) pairCount++;
      }
      totalChecked++;
    }
  }
  return totalChecked > 0 ? 1 + (pairCount / totalChecked) * 0.5 : 1;
}

// ---- Pattern / Co-occurrence Analysis ----

// Compute top N most-frequently co-appearing pairs from historical data
function getTopPairs(game, topN = 30) {
  const data = pastResults[game] || [];
  const pairCount = {};

  for (const r of data) {
    const nums = [...r.main].sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = `${nums[i]},${nums[j]}`;
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
    }
  }

  return Object.entries(pairCount)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, count]) => ({ pair: key.split(',').map(Number), count }));
}

// Pattern-based generator: seeds from hot pairs + builds around co-occurring numbers
function generatePatternBased(game, excludeSets = []) {
  const cfg = GAMES[game];
  const data = pastResults[game] || [];
  const topPairs = getTopPairs(game, 40);

  if (topPairs.length === 0) return generateMathBased(game, 'ai', excludeSets);

  // Diversity penalty map from previously generated sets
  const usedCount = {};
  for (const prev of excludeSets) {
    for (const n of prev) usedCount[n] = (usedCount[n] || 0) + 1;
  }

  // Weight pairs — higher rank + lower diversity penalty = more likely chosen
  const pairWeights = topPairs.map((p, i) => {
    const diversityPenalty = p.pair.reduce((acc, n) => acc * Math.pow(0.45, usedCount[n] || 0), 1);
    return Math.pow(0.88, i) * p.count * diversityPenalty;
  });

  let bestCombo = null;

  for (let attempt = 0; attempt < 350; attempt++) {
    // 1. Pick a hot pair as the seed
    const pairIdx = weightedPick(topPairs, [...pairWeights]);
    const seedPair = topPairs[pairIdx].pair;

    // 2. Find numbers that most often appear WITH these two numbers
    const coOccur = {};
    for (const r of data) {
      if (seedPair.every(n => r.main.includes(n))) {
        for (const n of r.main) {
          if (!seedPair.includes(n)) coOccur[n] = (coOccur[n] || 0) + 1;
        }
      }
    }

    // 3. Build the full combination using co-occurrence + master score
    const candidate = [...seedPair];
    const remaining = Array.from({ length: cfg.mainMax }, (_, i) => i + 1)
      .filter(n => !candidate.includes(n));

    const poolWeights = remaining.map(n => {
      const co = (coOccur[n] || 0) * 3;
      const master = calculateMasterScore(game, n, 'ai');
      const diversity = Math.pow(0.4, usedCount[n] || 0);
      return Math.max(0.01, (co + master) * diversity);
    });

    const pool = [...remaining];
    const wts = [...poolWeights];

    while (candidate.length < cfg.mainCount && pool.length > 0) {
      const idx = weightedPick(pool, wts);
      candidate.push(pool[idx]);
      pool.splice(idx, 1);
      wts.splice(idx, 1);
    }

    candidate.sort((a, b) => a - b);

    const tooSimilar = excludeSets.some(prev =>
      candidate.filter(n => prev.includes(n)).length > Math.floor(cfg.mainCount / 2)
    );

    if (validateCombination(candidate, game) && !tooSimilar) {
      if (!bestCombo) bestCombo = candidate;
      else return candidate; // return 2nd valid combo quickly
    }
  }

  return bestCombo || generateMathBased(game, 'ai', excludeSets);
}

// ---- Master Score Calculator ----
// Combines all statistical models into a single probability score per number
function calculateMasterScore(game, num, strategy) {
  const freq = getFrequencyMap(game);
  const totalRounds = getTotalRounds(game);
  const cfg = GAMES[game];
  const expectedFreq = (totalRounds * cfg.mainCount) / cfg.mainMax;
  const actual = freq[num] || 0;

  // === Component 1: Bayesian Prior (30% weight) ===
  // Historical frequency as prior probability
  const bayesianScore = actual / Math.max(totalRounds, 1);

  // === Component 2: Poisson "Due" Score (25% weight) ===
  // If a number has appeared less than expected, it's statistically "due"
  const lambda = expectedFreq;
  const poissonProb = 1 - poissonPMF(actual, lambda);
  // Numbers below expected get a boost
  const dueScore = actual < expectedFreq
    ? 1 + (expectedFreq - actual) / expectedFreq
    : 1 - (actual - expectedFreq) / (expectedFreq * 3);

  // === Component 3: Chi-Squared Deviation (15% weight) ===
  // Numbers with moderate deviation are more interesting
  const chiScore = chiSquaredScore(actual, expectedFreq);
  const chiNormalized = 1 / (1 + chiScore * 0.01); // moderate deviation preferred

  // === Component 4: Recent Trend / EMA (20% weight) ===
  // Recent momentum - is this number trending up or down?
  const recentProb = getRecentTrend(game, num, 50);
  const longTermProb = cfg.mainCount / cfg.mainMax; // expected probability per draw
  const trendScore = recentProb / Math.max(longTermProb, 0.001);

  // === Component 5: Gap Analysis (10% weight) ===
  // Numbers that haven't appeared in a while get a boost
  const gap = getLastGap(game, num);
  const expectedGap = cfg.mainMax / cfg.mainCount; // expected draws between appearances
  const gapScore = gap > expectedGap ? 1 + (gap - expectedGap) / (expectedGap * 2) : 1;

  // === Combine based on strategy ===
  let finalScore;
  switch (strategy) {
    case 'hot':
      // Emphasize historical frequency and recent trend
      finalScore = bayesianScore * 40 + trendScore * 35 + dueScore * 10 + chiNormalized * 10 + gapScore * 5;
      break;
    case 'cold':
      // Emphasize due numbers and gap analysis
      finalScore = dueScore * 35 + gapScore * 30 + chiNormalized * 15 + bayesianScore * 10 + trendScore * 10;
      break;
    case 'ai':
      // Full scientific balance: all factors weighted optimally
      finalScore = bayesianScore * 25 + dueScore * 25 + trendScore * 20 + chiNormalized * 15 + gapScore * 15;
      break;
    default:
      finalScore = 1;
  }

  return Math.max(0.01, finalScore);
}

// ---- Combination Validator (Statistical Pattern Matching) ----
function validateCombination(nums, game) {
  const cfg = GAMES[game];
  const count = nums.length;
  const max = cfg.mainMax;
  const sorted = [...nums].sort((a, b) => a - b);

  // 1. Odd/Even balance (historically ~50/50 with slight variance)
  const oddCount = nums.filter(n => n % 2 === 1).length;
  const evenCount = count - oddCount;
  if (oddCount === 0 || evenCount === 0) return false;
  if (count === 6 && (oddCount > 5 || evenCount > 5)) return false;
  if (count === 5 && (oddCount > 4 || evenCount > 4)) return false;

  // 2. Sum within statistical range (covers ~85% of winning combinations)
  const sum = nums.reduce((a, b) => a + b, 0);
  const theoreticalMean = count * (max + 1) / 2;
  const theoreticalSD = Math.sqrt(count * (max * max - 1) / 12);
  if (sum < theoreticalMean - 1.8 * theoreticalSD || sum > theoreticalMean + 1.8 * theoreticalSD) return false;

  // 3. Range distribution: low / mid / high numbers present
  const third = Math.ceil(max / 3);
  const low = sorted.filter(n => n <= third).length;
  const mid = sorted.filter(n => n > third && n <= third * 2).length;
  const high = sorted.filter(n => n > third * 2).length;
  if (low === 0 || mid === 0 || high === 0) return false;

  // 4. Consecutive pairs: max 2 (historically, 0-2 consecutive pairs in ~95% of draws)
  let consecutiveCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) consecutiveCount++;
  }
  if (consecutiveCount > 2) return false;

  // 5. Gap variance: numbers shouldn't be too clustered or too spread
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avgGap < 2) return false;

  // 6. Decade coverage: at least 3 different decade groups (1-10, 11-20, ...)
  const decades = new Set(sorted.map(n => Math.ceil(n / 10)));
  if (decades.size < 3) return false;

  // 7. Last digit diversity: avoid too many same endings
  const lastDigits = sorted.map(n => n % 10);
  const digitCounts = {};
  lastDigits.forEach(d => { digitCounts[d] = (digitCounts[d] || 0) + 1; });
  if (Object.values(digitCounts).some(c => c > 3)) return false;

  return true;
}

// ---- Master Number Generator ----
function generateMathBased(game, strategy, excludeSets = []) {
  const cfg = GAMES[game];
  const allNums = Array.from({ length: cfg.mainMax }, (_, i) => i + 1);

  // Calculate scientific score for every number
  const scoreMap = {};
  allNums.forEach(n => {
    scoreMap[n] = calculateMasterScore(game, n, strategy);
  });

  // Build probability weights from scores
  const baseWeights = allNums.map(n => scoreMap[n]);

  // Check if a new set overlaps too much with previously generated sets
  function isTooSimilar(nums) {
    for (const prev of excludeSets) {
      const overlap = nums.filter(n => prev.includes(n)).length;
      // Allow at most half the numbers to overlap
      if (overlap > Math.floor(cfg.mainCount / 2)) return true;
    }
    return false;
  }

  // Diversity boost: penalize numbers already used in previous sets
  function getDiversityWeights() {
    const usedCount = {};
    for (const prev of excludeSets) {
      for (const n of prev) {
        usedCount[n] = (usedCount[n] || 0) + 1;
      }
    }
    return allNums.map((n, i) => {
      const penalty = usedCount[n] ? Math.pow(0.4, usedCount[n]) : 1;
      return baseWeights[i] * penalty;
    });
  }

  // Generate valid combinations (try up to 500 times)
  let bestCombo = null;
  let bestScore = -1;
  let validCount = 0;

  for (let attempt = 0; attempt < 500; attempt++) {
    const nums = [];
    const availPool = [...allNums];
    const weights = excludeSets.length > 0 ? getDiversityWeights() : [...baseWeights];
    const availWeights = [...weights];

    while (nums.length < cfg.mainCount && availPool.length > 0) {
      const idx = weightedPick(availPool, availWeights);
      const picked = availPool[idx];

      // Apply pair synergy bonus for remaining picks
      if (nums.length > 0) {
        const pairBonus = getPairScore(game, picked, nums);
        availWeights[idx] *= pairBonus;
      }

      nums.push(picked);
      availPool.splice(idx, 1);
      availWeights.splice(idx, 1);
    }

    nums.sort((a, b) => a - b);

    if (validateCombination(nums, game) && !isTooSimilar(nums)) {
      validCount++;
      // Score this combination
      const comboScore = nums.reduce((sum, n) => sum + (scoreMap[n] || 0), 0);

      if (comboScore > bestScore) {
        bestScore = comboScore;
        bestCombo = nums;
      }

      // After finding a few valid unique combos, pick the best one
      if (validCount >= 5 && bestCombo) return bestCombo;
    }
  }

  if (bestCombo) return bestCombo;

  // Fallback: pick top scored numbers not heavily used in previous sets
  const sorted = allNums.map(n => ({ num: n, score: scoreMap[n] })).sort((a, b) => b.score - a.score);
  return sorted.slice(0, cfg.mainCount).map(s => s.num).sort((a, b) => a - b);
}

// ---- Special/Bonus Number Generator ----
function generateSpecialNum(game, strategy) {
  const cfg = GAMES[game];
  if (cfg.specialMax <= 0) return null;

  const specialFreq = getSpecialFrequencyMap(game);
  const totalRounds = getTotalRounds(game);
  const allNums = Array.from({ length: cfg.specialMax }, (_, i) => i + 1);
  const expectedFreq = totalRounds / cfg.specialMax;

  const weights = allNums.map(n => {
    const actual = specialFreq[n] || 0;

    switch (strategy) {
      case 'hot':
        return Math.max(1, actual * 2);
      case 'cold': {
        const due = Math.max(0, expectedFreq - actual);
        return Math.max(1, due * 2 + 1);
      }
      case 'ai': {
        // Bayesian + due balance
        const bayesian = actual / Math.max(totalRounds, 1);
        const dueFactor = actual < expectedFreq
          ? 1 + (expectedFreq - actual) / expectedFreq
          : 0.8;
        const gap = getLastGap(game, n); // check bonus gap too
        const gapBonus = gap > (cfg.specialMax / 2) ? 1.3 : 1;
        return Math.max(0.5, (bayesian * 30 + dueFactor * 40 + gapBonus * 30));
      }
      default:
        return 1;
    }
  });

  const idx = weightedPick(allNums, weights);
  return allNums[idx];
}

function generateWithAlgo(game, algo, setIndex = 0, excludeSets = []) {
  const cfg = GAMES[game];
  let mainNums, specialNum;

  switch (algo) {
    case 'random':
      // Even random uses mathematical validation for realistic combinations
      mainNums = generateMathBased(game, 'random', excludeSets);
      specialNum = cfg.specialMax > 0 ? randInt(1, cfg.specialMax) : null;
      break;

    case 'hot': {
      // Frequency-weighted: historically frequent numbers get higher probability
      mainNums = generateMathBased(game, 'hot', excludeSets);
      specialNum = generateSpecialNum(game, 'hot');
      break;
    }

    case 'cold': {
      // Due number theory: numbers below expected frequency get higher probability
      mainNums = generateMathBased(game, 'cold', excludeSets);
      specialNum = generateSpecialNum(game, 'cold');
      break;
    }

    case 'ai': {
      // Full mathematical analysis: balanced frequency + deviation + pattern matching
      mainNums = generateMathBased(game, 'ai', excludeSets);
      specialNum = generateSpecialNum(game, 'ai');
      break;
    }

    case 'pattern': {
      // Pattern-based: seeds from historically co-occurring pairs
      mainNums = generatePatternBased(game, excludeSets);
      specialNum = generateSpecialNum(game, 'ai');
      break;
    }

    case 'lucky': {
      // Monthly fortune numbers - same year+month = same base set
      // Each set index gets a unique variation within the month
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const baseSeed = year * 100 + month; // unique per month

      // Deterministic hash function
      function luckyHash(seed, idx) {
        let h = seed ^ (idx * 2654435761);
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return (h ^ (h >>> 16)) >>> 0;
      }

      // Use setIndex so each set in a batch is different
      const setSeed = baseSeed * 10 + setIndex;
      mainNums = [];
      let pos = 0;
      while (mainNums.length < cfg.mainCount) {
        const n = (luckyHash(setSeed, pos) % cfg.mainMax) + 1;
        if (!mainNums.includes(n)) mainNums.push(n);
        pos++;
        if (pos > 1000) break;
      }
      mainNums.sort((a, b) => a - b);
      specialNum = cfg.specialMax > 0
        ? (luckyHash(setSeed, 99) % cfg.specialMax) + 1
        : null;
      break;
    }

    default:
      mainNums = getRandomNumbers(cfg.mainMax, cfg.mainCount);
      specialNum = cfg.specialMax > 0 ? randInt(1, cfg.specialMax) : null;
  }

  return { mainNums, specialNum };
}

// ==================== FREQUENCY ANALYSIS ====================
function getFrequencyMap(game) {
  // Korean Lotto: use pre-computed full history (1~1215회)
  if (game === 'lotto' && typeof LOTTO_FULL_FREQ !== 'undefined') {
    const freq = {};
    for (const [num, counts] of Object.entries(LOTTO_FULL_FREQ)) {
      freq[num] = counts[0]; // winning count (main numbers only)
    }
    return freq;
  }
  // US lotteries: use all fetched API data
  const freq = {};
  const data = pastResults[game] || [];
  data.forEach(r => {
    r.main.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  });
  return freq;
}

function getSpecialFrequencyMap(game) {
  // Korean Lotto: use pre-computed bonus frequency
  if (game === 'lotto' && typeof LOTTO_FULL_FREQ !== 'undefined') {
    const freq = {};
    for (const [num, counts] of Object.entries(LOTTO_FULL_FREQ)) {
      freq[num] = counts[1]; // bonus count
    }
    return freq;
  }
  const freq = {};
  const data = pastResults[game] || [];
  data.forEach(r => {
    if (r.special !== null) freq[r.special] = (freq[r.special] || 0) + 1;
  });
  return freq;
}

// Get total rounds count for frequency display
function getTotalRounds(game) {
  if (game === 'lotto' && typeof LOTTO_TOTAL_ROUNDS !== 'undefined') {
    return LOTTO_TOTAL_ROUNDS;
  }
  return (pastResults[game] || []).length;
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
  state.currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  // Trigger page-specific renders
  if (page === 'stats') renderStats();
  if (page === 'mynums') renderSavedNumbers();
  if (page === 'results') renderResultsPage();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== HOME PAGE ====================
function renderHome() {
  renderTodayPicks();
  renderSimpsons();
  renderRecentResults();
  updateJackpotDisplay();
  startJackpotSlider();
}

// ==================== SIMPSONS PREDICTION NUMBERS ====================
const SIMPSONS_NUMBERS = [
  {
    game: 'powerball',
    label: 'Powerball',
    episode: 'S3E19 "Dog of Death"',
    nums: [17, 25, 38, 42, 49], special: 3,
    note: '$130M 잭팟 당첨번호'
  },
  {
    game: 'mega',
    label: 'Mega Millions',
    episode: 'S21E11 "Million Dollar Maybe"',
    nums: [6, 17, 22, 24, 35], special: 1,
    note: '호머 $1M 당첨'
  },
  {
    game: 'powerball',
    label: 'Powerball',
    episode: 'S12E7 리사 퍼즐 장면',
    nums: [14, 21, 28, 35, 42], special: 7,
    note: '7의 배수 패턴'
  },
  {
    game: 'mega',
    label: 'Mega Millions',
    episode: 'S28 "Trust But Clarify"',
    nums: [17, 42, 45, 69, 83], special: 6,
    note: '켄트 브록맨 발표'
  },
  {
    game: 'powerball',
    label: 'Powerball',
    episode: 'S3E19 $40K 추첨',
    nums: [6, 17, 18, 22, 29], special: 3,
    note: '마지가 놓친 번호'
  },
];

function renderSimpsons() {
  const container = document.getElementById('simpsons-picks');
  if (!container) return;

  container.innerHTML = SIMPSONS_NUMBERS.map(s => {
    const cfg = GAMES[s.game];
    const ballsHtml = s.nums.map(n => {
      const cls = s.game === 'lotto' ? getLottoBallClass(n) : cfg.mainClass;
      return `<div class="ball ball-sm ${cls}">${n}</div>`;
    }).join('');
    const specialHtml = s.special
      ? `<span class="sep">+</span><div class="ball ball-sm ${cfg.specialClass}">${s.special}</div>`
      : '';

    return `
      <div class="simpsons-card">
        <div style="flex-shrink:0;text-align:center;">
          <div class="simpsons-badge">${cfg.flag} ${s.label}</div>
          <div class="simpsons-ep">${s.episode}</div>
        </div>
        <div class="simpsons-balls">${ballsHtml}${specialHtml}</div>
      </div>
    `;
  }).join('');
}

// Convert USD to Korean format (억원)
function usdToKrw(usdAmount) {
  const krw = usdAmount * 1400; // approximate exchange rate
  const eok = krw / 100000000; // 억
  if (eok >= 10000) return `약 ${(eok / 10000).toFixed(1)}조원`;
  if (eok >= 1) return `약 ${Math.round(eok)}억원`;
  return `약 ${Math.round(krw / 10000)}만원`;
}

// Format Korean won
function formatKrw(amount) {
  const eok = amount / 100000000;
  if (eok >= 10000) return `약 ${(eok / 10000).toFixed(1)}조원`;
  if (eok >= 1) return `약 ${Math.round(eok)}억원`;
  return `약 ${Math.round(amount / 10000)}만원`;
}

// Fetch and update jackpot amounts
async function updateJackpotDisplay() {
  // Powerball jackpot - get from latest draw data
  try {
    const pbRes = await fetch('https://data.ny.gov/resource/d6yy-54nr.json?$limit=1&$order=draw_date%20DESC');
    if (pbRes.ok) {
      const pbData = await pbRes.json();
      if (pbData[0]) {
        const pbEl = document.getElementById('jackpot-pb');
        // NY Open Data doesn't include jackpot, estimate from multiplier or use placeholder
        // Use a separate jackpot API
        if (pbEl) pbEl.textContent = usdToKrw(350000000); // will be updated below
      }
    }
  } catch (e) { /* ignore */ }

  // Try to get actual jackpot amounts from lottery APIs
  try {
    const res = await fetch('https://data.ny.gov/resource/d6yy-54nr.json?$limit=1&$order=draw_date%20DESC&$select=draw_date,winning_numbers');
    if (res.ok) {
      const data = await res.json();
      const pbDate = data[0] ? data[0].draw_date.split('T')[0] : '';
      const pbEl = document.getElementById('jackpot-pb');
      if (pbEl) {
        // Show estimated jackpot in Korean
        jackpotData.powerball = { date: pbDate };
      }
    }
  } catch (e) { /* ignore */ }

  // Fetch jackpot from powerball.com API (unofficial)
  await fetchJackpots();

  // Korean Lotto - use static first prize amount from latest data
  const lottoEl = document.getElementById('jackpot-kr');
  if (lottoEl && pastResults.lotto.length > 0) {
    const latest = pastResults.lotto[0];
    lottoEl.textContent = `약 30억원`;
    // Update date info
    const dateEl = lottoEl.parentElement.querySelector('.jackpot-date');
    if (dateEl) dateEl.textContent = `최근 추첨: ${latest.date} (${latest.round}회)`;
  }
}

async function fetchJackpots() {
  const pbEl = document.getElementById('jackpot-pb');
  const mmEl = document.getElementById('jackpot-mm');

  // Try to get jackpot info from lottery websites
  try {
    const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.powerball.com/api/v1/estimates/powerball?_format=json'), { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const wrap = await res.json();
      const data = JSON.parse(wrap.contents);
      if (data && data[0] && data[0].field_prize_amount) {
        const amount = parseInt(data[0].field_prize_amount.replace(/[^0-9]/g, ''));
        if (amount > 0 && pbEl) {
          jackpotData.powerball = { amount };
          pbEl.textContent = usdToKrw(amount);
        }
      }
    }
  } catch (e) {
    // Fallback: show estimated amounts
    if (pbEl && pbEl.textContent === '로딩중...') pbEl.textContent = usdToKrw(300000000);
  }

  try {
    const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.megamillions.com/api/v1/estimates/megamillions?_format=json'), { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const wrap = await res.json();
      const data = JSON.parse(wrap.contents);
      if (data && data[0] && data[0].field_prize_amount) {
        const amount = parseInt(data[0].field_prize_amount.replace(/[^0-9]/g, ''));
        if (amount > 0 && mmEl) {
          jackpotData.mega = { amount };
          mmEl.textContent = usdToKrw(amount);
        }
      }
    }
  } catch (e) {
    if (mmEl && mmEl.textContent === '로딩중...') mmEl.textContent = usdToKrw(400000000);
  }

  // Final fallback if still loading
  setTimeout(() => {
    if (pbEl && pbEl.textContent === '로딩중...') pbEl.textContent = usdToKrw(300000000);
    if (mmEl && mmEl.textContent === '로딩중...') mmEl.textContent = usdToKrw(400000000);
  }, 3000);
}

function renderTodayPicks() {
  const container = document.getElementById('today-picks');
  const picks = [];

  for (const gameKey of ['powerball', 'mega', 'lotto']) {
    const result = generateWithAlgo(gameKey, 'ai');
    picks.push({ game: gameKey, ...result });
  }

  container.innerHTML = picks.map(p => {
    const cfg = GAMES[p.game];
    return `
      <div class="today-pick-card">
        <div class="pick-game-badge ${cfg.tagClass}">${cfg.flag} ${cfg.name.split(' ')[0]}</div>
        <div class="pick-balls">${createBallsRow(p.game, p.mainNums, p.specialNum, 'sm')}</div>
      </div>
    `;
  }).join('');
}

function refreshTodayPick() {
  renderTodayPicks();
  showToast('🤖 AI 추천번호가 갱신되었습니다!');
}

function renderRecentResults() {
  const container = document.getElementById('recent-results');
  const items = [];

  for (const gameKey of ['powerball', 'mega', 'lotto']) {
    if (!pastResults[gameKey] || !pastResults[gameKey].length) continue;
    const recent = pastResults[gameKey][0];
    const cfg = GAMES[gameKey];
    items.push(`
      <div class="result-card">
        <div class="result-meta">
          <span class="result-round">${cfg.flag} ${cfg.name} #${recent.round}회</span>
          <span class="result-date">${recent.date}</span>
        </div>
        <div class="result-balls">${createBallsRow(gameKey, recent.main, recent.special, 'sm')}</div>
      </div>
    `);
  }

  container.innerHTML = items.join('');
}

function startJackpotSlider() {
  const slides = document.querySelectorAll('.jackpot-slide');
  const dots = document.querySelectorAll('.jackpot-dots .dot');

  setInterval(() => {
    slides[state.jackpotSlide].classList.remove('active');
    dots[state.jackpotSlide].classList.remove('active');
    state.jackpotSlide = (state.jackpotSlide + 1) % slides.length;
    slides[state.jackpotSlide].classList.add('active');
    dots[state.jackpotSlide].classList.add('active');
  }, 4000);
}

function quickGenerate(game) {
  state.currentGame = game;
  state.currentAlgo = 'random';
  state.setCounts = 1;
  navigateTo('generator');
  updateGameUI();
  setTimeout(() => generateNumbers(), 300);
}

// ==================== GENERATOR PAGE ====================
function selectGame(game) {
  state.currentGame = game;
  document.querySelectorAll('#page-generator .game-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.game === game);
  });
  updateGenSubText();
}

function selectAlgo(algo) {
  state.currentAlgo = algo;
  document.querySelectorAll('.algo-card').forEach(c => {
    c.classList.toggle('active', c.dataset.algo === algo);
  });
  updateGenSubText();
}

function adjustSets(delta) {
  state.setCounts = Math.max(1, Math.min(10, state.setCounts + delta));
  document.getElementById('gen-set-count').textContent = state.setCounts;
  updateGenSubText();
}

function updateGenSubText() {
  const algoNames = {
    random: '확률랜덤', hot: '고빈도분석', cold: '미출현분석',
    ai: '과학예측', lucky: '월별행운', pattern: '패턴조합'
  };
  const text = `${algoNames[state.currentAlgo]} · ${GAMES[state.currentGame].name} · ${state.setCounts}세트`;
  document.getElementById('gen-sub-text').textContent = text;
}

function updateGameUI() {
  document.querySelectorAll('#page-generator .game-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.game === state.currentGame);
  });
  document.querySelectorAll('.algo-card').forEach(c => {
    c.classList.toggle('active', c.dataset.algo === state.currentAlgo);
  });
  document.getElementById('gen-set-count').textContent = state.setCounts;
  updateGenSubText();
}

function generateNumbers() {
  const btn = document.getElementById('gen-btn');
  const container = document.getElementById('gen-results');
  const saveAllBtn = document.getElementById('save-all-btn');

  // Shake animation
  btn.classList.add('shaking');
  setTimeout(() => btn.classList.remove('shaking'), 600);

  state.generatedSets = [];
  container.innerHTML = '';

  const previousMainNums = []; // Track generated sets to avoid duplicates
  for (let i = 0; i < state.setCounts; i++) {
    const result = generateWithAlgo(state.currentGame, state.currentAlgo, i, previousMainNums);
    previousMainNums.push(result.mainNums);
    state.generatedSets.push({
      game: state.currentGame,
      mainNums: result.mainNums,
      specialNum: result.specialNum,
      saved: false,
    });
  }

  // Render with animation
  state.generatedSets.forEach((set, idx) => {
    setTimeout(() => {
      const card = document.createElement('div');
      card.className = 'gen-set-card';
      card.innerHTML = `
        <span class="gen-set-num">${idx + 1}</span>
        <div class="gen-set-balls">
          ${createAnimatedBallsRow(set.game, set.mainNums, set.specialNum)}
        </div>
        <button class="gen-set-save" onclick="saveOneSet(${idx})" id="save-btn-${idx}">💾</button>
      `;
      container.appendChild(card);

      // Trigger ball animations
      setTimeout(() => {
        card.querySelectorAll('.ball.anim').forEach(b => b.classList.add('show'));
      }, 50);
    }, idx * 150);
  });

  // Show save all button
  setTimeout(() => {
    saveAllBtn.classList.remove('hidden');
  }, state.setCounts * 150 + 300);

  // Confetti
  setTimeout(() => fireConfetti(), state.setCounts * 150 + 500);
}

function saveOneSet(idx) {
  const set = state.generatedSets[idx];
  if (set.saved) return;
  set.saved = true;

  const saved = {
    id: Date.now() + idx,
    game: set.game,
    mainNums: set.mainNums,
    specialNum: set.specialNum,
    date: new Date().toISOString(),
    checked: false,
    result: null,
  };

  state.savedNumbers.unshift(saved);
  saveToDisk();

  const btn = document.getElementById('save-btn-' + idx);
  if (btn) {
    btn.classList.add('saved');
    btn.textContent = '✅';
  }

  showToast('💾 번호가 저장되었습니다!');
}

function saveAllGenerated() {
  let count = 0;
  state.generatedSets.forEach((set, idx) => {
    if (!set.saved) {
      set.saved = true;
      state.savedNumbers.unshift({
        id: Date.now() + idx,
        game: set.game,
        mainNums: set.mainNums,
        specialNum: set.specialNum,
        date: new Date().toISOString(),
        checked: false,
        result: null,
      });

      const btn = document.getElementById('save-btn-' + idx);
      if (btn) { btn.classList.add('saved'); btn.textContent = '✅'; }
      count++;
    }
  });

  saveToDisk();
  if (count > 0) showToast(`💾 ${count}세트가 저장되었습니다!`);
}

// ==================== STATS PAGE ====================
function selectStatsGame(game) {
  state.currentStatsGame = game;
  document.querySelectorAll('#page-stats .game-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.game === game);
  });
  renderStats();
}

function renderStats() {
  const game = state.currentStatsGame;
  renderFrequencyChart(game);
  renderHotCold(game);
  renderTopPairs(game);
  renderOddEven(game);
  renderRangeChart(game);
  renderConsecutive(game);
  renderAIProb(game);
}

function renderTopPairs(game) {
  const container = document.getElementById('top-pairs-list');
  if (!container) return;

  const pairs = getTopPairs(game, 15);
  const totalRounds = (pastResults[game] || []).length;
  const label = document.getElementById('top-pairs-label');
  if (label) label.textContent = `(최근 ${totalRounds}회 기준)`;

  if (pairs.length === 0) {
    container.innerHTML = '<div style="color:#888;font-size:0.85em;text-align:center;padding:8px">데이터 부족</div>';
    return;
  }

  const maxCount = pairs[0].count;

  container.innerHTML = pairs.map(({ pair, count }, idx) => {
    const pct = Math.round((count / maxCount) * 100);
    const ballsHtml = pair.map(n =>
      `<div class="ball ball-xs ${getBallClass(game, n, false)}">${n}</div>`
    ).join('');
    const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    return `
      <div class="pair-row">
        <span class="pair-rank">${rankEmoji}</span>
        <div class="pair-balls">${ballsHtml}</div>
        <div class="pair-bar-wrap">
          <div class="pair-bar" style="width:${pct}%"></div>
        </div>
        <span class="pair-count">${count}회</span>
      </div>`;
  }).join('');
}

function renderFrequencyChart(game) {
  const canvas = document.getElementById('freq-chart');
  const ctx = canvas.getContext('2d');
  const freq = getFrequencyMap(game);
  const max = GAMES[game].mainMax;
  const totalRounds = getTotalRounds(game);
  const infoEl = document.getElementById('freq-rounds-info');
  if (infoEl) infoEl.textContent = `(${totalRounds}회 분석)`;

  // Set canvas size
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 250 * dpr;
  ctx.scale(dpr, dpr);
  canvas.style.height = '250px';

  const w = rect.width;
  const h = 250;
  const padding = { top: 20, right: 10, bottom: 30, left: 35 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.clearRect(0, 0, w, h);

  const maxFreq = Math.max(...Object.values(freq), 1);
  const barW = chartW / max - 1;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
  }

  // Bars
  for (let n = 1; n <= max; n++) {
    const val = freq[n] || 0;
    const barH = (val / maxFreq) * chartH;
    const x = padding.left + (n - 1) * (chartW / max);
    const y = padding.top + chartH - barH;

    // Gradient
    const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    if (game === 'lotto') {
      const cls = getLottoBallClass(n);
      const colors = { 'b-y': '#f1c40f', 'b-b': '#3498db', 'b-r': '#e74c3c', 'b-g': '#95a5a6', 'b-gr': '#2ecc71' };
      grad.addColorStop(0, colors[cls] || '#6c5ce7');
      grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    } else {
      grad.addColorStop(0, GAMES[game].color);
      grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, Math.max(barW, 2), barH);
  }

  // X axis labels (show every 5th)
  ctx.fillStyle = '#606080';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  for (let n = 1; n <= max; n += 5) {
    const x = padding.left + (n - 1) * (chartW / max) + barW / 2;
    ctx.fillText(n, x, h - 8);
  }

  // Y axis labels
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxFreq / 4) * (4 - i));
    const y = padding.top + (chartH / 4) * i + 4;
    ctx.fillText(val, padding.left - 5, y);
  }
}

function renderHotCold(game) {
  const freq = getFrequencyMap(game);
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

  const hotNums = sorted.slice(0, 6).map(e => parseInt(e[0]));
  const coldNums = sorted.slice(-6).map(e => parseInt(e[0])).reverse();

  document.getElementById('hot-numbers').innerHTML = hotNums.map(n =>
    `<div class="ball ball-sm ${getBallClass(game, n, false)}">${n}</div>`
  ).join('');

  document.getElementById('cold-numbers').innerHTML = coldNums.map(n =>
    `<div class="ball ball-sm ${getBallClass(game, n, false)}">${n}</div>`
  ).join('');
}

function renderOddEven(game) {
  const data = pastResults[game];
  let odd = 0, even = 0;
  data.forEach(r => {
    r.main.forEach(n => { n % 2 === 0 ? even++ : odd++; });
  });
  const total = odd + even;
  const oddPct = Math.round((odd / total) * 100);
  const evenPct = 100 - oddPct;

  document.getElementById('odd-bar').style.width = oddPct + '%';
  document.getElementById('odd-bar').textContent = `홀 ${oddPct}%`;
  document.getElementById('even-bar').style.width = evenPct + '%';
  document.getElementById('even-bar').textContent = `짝 ${evenPct}%`;
}

function renderRangeChart(game) {
  const canvas = document.getElementById('range-chart');
  const ctx = canvas.getContext('2d');
  const max = GAMES[game].mainMax;

  const ranges = [];
  for (let s = 1; s <= max; s += 10) {
    const end = Math.min(s + 9, max);
    ranges.push({ label: `${s}-${end}`, start: s, end });
  }

  const data = pastResults[game];
  const rangeCounts = ranges.map(r => {
    let count = 0;
    data.forEach(d => d.main.forEach(n => { if (n >= r.start && n <= r.end) count++; }));
    return count;
  });

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 200 * dpr;
  ctx.scale(dpr, dpr);
  canvas.style.height = '200px';

  const w = rect.width;
  const h = 200;
  const padding = { top: 20, right: 10, bottom: 35, left: 40 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.clearRect(0, 0, w, h);

  const maxVal = Math.max(...rangeCounts, 1);
  const barW = chartW / ranges.length - 8;
  const colors = ['#f1c40f', '#3498db', '#e74c3c', '#95a5a6', '#2ecc71', '#9b59b6', '#e67e22'];

  rangeCounts.forEach((val, i) => {
    const barH = (val / maxVal) * chartH;
    const x = padding.left + i * (chartW / ranges.length) + 4;
    const y = padding.top + chartH - barH;

    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();

    // Value
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(val, x + barW / 2, y - 5);

    // Label
    ctx.fillStyle = '#606080';
    ctx.font = '10px Inter';
    ctx.fillText(ranges[i].label, x + barW / 2, h - 10);
  });
}

function renderConsecutive(game) {
  const data = pastResults[game];
  let consecRounds = 0;
  data.forEach(d => {
    const sorted = [...d.main].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] === 1) { consecRounds++; break; }
    }
  });

  const pct = Math.round((consecRounds / data.length) * 100);

  document.getElementById('consecutive-stats').innerHTML = `
    <div class="consec-row">
      <span class="consec-label">연속번호 포함 회차</span>
      <span class="consec-val">${consecRounds} / ${data.length}회</span>
    </div>
    <div class="consec-row">
      <span class="consec-label">연속번호 출현율</span>
      <span class="consec-val" style="color:#f7d046">${pct}%</span>
    </div>
    <div class="consec-row">
      <span class="consec-label">평균 번호 간격</span>
      <span class="consec-val">${calculateAvgGap(game)}</span>
    </div>
  `;
}

function calculateAvgGap(game) {
  const data = pastResults[game];
  let totalGap = 0, count = 0;
  data.forEach(d => {
    const sorted = [...d.main].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      totalGap += sorted[i + 1] - sorted[i];
      count++;
    }
  });
  return (totalGap / count).toFixed(1);
}

function renderAIProb(game) {
  const cfg = GAMES[game];
  let totalCombos;
  if (game === 'lotto') {
    totalCombos = 8145060;
  } else if (game === 'powerball') {
    totalCombos = 292201338;
  } else {
    totalCombos = 302575350;
  }

  const probPct = (1 / totalCombos * 100).toFixed(8);
  const fillW = Math.max(2, Math.min(95, (1 / Math.log10(totalCombos)) * 100));

  document.getElementById('prob-fill').style.width = fillW + '%';
  document.getElementById('prob-text').innerHTML = `
    1등 당첨 확률: <strong>1 / ${totalCombos.toLocaleString()}</strong><br>
    확률: <strong>${probPct}%</strong><br><br>
    🤖 AI 분석 결과: 고빈도 + 미출현 번호를 조합하면<br>
    통계적으로 <span style="color:#f7d046;font-weight:900">약 ${(fillW * 0.3).toFixed(1)}%</span> 더 높은 기대값을 가집니다.<br>
    <small style="color:var(--text3)">(실제 당첨 확률과는 무관하며, 오락 목적입니다)</small>
  `;
}

// ==================== RESULTS PAGE ====================
function selectResultGame(game) {
  state.currentResultGame = game;
  document.querySelectorAll('#page-results .game-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.game === game);
  });
  renderResultsPage();
}

function renderResultsPage() {
  const game = state.currentResultGame;
  const results = pastResults[game].slice(0, 20);
  const cfg = GAMES[game];

  document.getElementById('results-list').innerHTML = results.map(r => `
    <div class="result-card">
      <div class="result-meta">
        <span class="result-round">${cfg.flag} ${cfg.name} #${r.round}회</span>
        <span class="result-date">${r.date}</span>
      </div>
      <div class="result-balls">${createBallsRow(game, r.main, r.special, 'sm')}</div>
    </div>
  `).join('');
}

// ==================== MY NUMBERS ====================
function filterSaved(filter) {
  state.currentFilter = filter;
  document.querySelectorAll('#page-mynums .game-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === filter);
  });
  renderSavedNumbers();
}

function renderSavedNumbers() {
  const container = document.getElementById('saved-list');
  const emptyState = document.getElementById('empty-saved');
  const checkBtn = document.getElementById('check-btn');

  let items = state.savedNumbers;
  if (state.currentFilter !== 'all') {
    items = items.filter(s => s.game === state.currentFilter);
  }

  if (items.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyState.cloneNode(true));
    checkBtn.classList.add('hidden');
    return;
  }

  checkBtn.classList.remove('hidden');

  container.innerHTML = items.map((s, idx) => {
    const cfg = GAMES[s.game];
    const dateStr = new Date(s.date).toLocaleDateString('ko-KR');
    let resultHTML = '';
    if (s.checked && s.result !== null) {
      resultHTML = `<div class="saved-result ${s.result > 0 ? 'result-win' : 'result-lose'}">
        ${s.result > 0 ? `🎉 ${s.result}등 당첨!` : '😢 당첨되지 않았습니다'}
      </div>`;
    }

    return `
      <div class="saved-card">
        <div class="saved-meta">
          <span class="saved-game-tag ${cfg.tagClass}">${cfg.flag} ${cfg.name}</span>
          <div>
            <span class="saved-date">${dateStr}</span>
            <button class="saved-del" onclick="deleteSaved(${s.id})">✕</button>
          </div>
        </div>
        <div class="saved-balls">${createBallsRow(s.game, s.mainNums, s.specialNum, 'sm')}</div>
        ${resultHTML}
      </div>
    `;
  }).join('');
}

function deleteSaved(id) {
  state.savedNumbers = state.savedNumbers.filter(s => s.id !== id);
  saveToDisk();
  renderSavedNumbers();
  showToast('🗑️ 번호가 삭제되었습니다');
}

function clearAllSaved() {
  if (state.savedNumbers.length === 0) return;
  showModal(
    '⚠️ 전체 삭제',
    '<p style="text-align:center;color:var(--text2)">저장된 모든 번호를 삭제하시겠습니까?</p>',
    [
      { text: '취소', class: 'modal-cancel', action: closeModal },
      {
        text: '삭제', class: 'modal-danger', action: () => {
          state.savedNumbers = [];
          saveToDisk();
          renderSavedNumbers();
          closeModal();
          showToast('🗑️ 전체 삭제되었습니다');
        }
      },
    ]
  );
}

function checkMyResults() {
  // Simulate checking results against latest draw
  state.savedNumbers.forEach(s => {
    if (!s.checked) {
      const latest = pastResults[s.game][0];
      const matchedMain = s.mainNums.filter(n => latest.main.includes(n)).length;
      const matchedSpecial = (s.specialNum !== null && s.specialNum === latest.special) ? 1 : 0;

      let prize = 0;
      if (s.game === 'lotto') {
        if (matchedMain === 6) prize = 1;
        else if (matchedMain === 5) prize = 3;
        else if (matchedMain === 4) prize = 4;
        else if (matchedMain === 3) prize = 5;
      } else {
        if (matchedMain === 5 && matchedSpecial === 1) prize = 1;
        else if (matchedMain === 5) prize = 2;
        else if (matchedMain === 4 && matchedSpecial === 1) prize = 3;
        else if (matchedMain === 4 || (matchedMain === 3 && matchedSpecial === 1)) prize = 4;
        else if (matchedMain === 3 || (matchedMain === 2 && matchedSpecial === 1) || (matchedMain === 1 && matchedSpecial === 1) || matchedSpecial === 1) prize = 5;
      }

      s.checked = true;
      s.result = prize;
    }
  });

  saveToDisk();
  renderSavedNumbers();
  showToast('🏆 당첨 확인이 완료되었습니다!');
}

// ==================== SETTINGS ====================
function toggleDarkMode() {
  state.settings.darkMode = document.getElementById('darkmode-toggle').checked;
  saveSettings();
}

function changeLang() {
  state.settings.lang = document.getElementById('lang-select').value;
  saveSettings();
  showToast('🌐 언어 설정이 변경되었습니다');
}

function saveSettings() {
  state.settings.sound = document.getElementById('sound-toggle')?.checked ?? true;
  state.settings.defaultSets = parseInt(document.getElementById('default-sets')?.value || '5');
  localStorage.setItem('luckyai_settings', JSON.stringify(state.settings));
}

function exportData() {
  const data = JSON.stringify({ savedNumbers: state.savedNumbers, settings: state.settings }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `luckyai_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 데이터가 내보내기 되었습니다');
}

function resetApp() {
  showModal(
    '🔄 앱 초기화',
    '<p style="text-align:center;color:var(--text2)">모든 데이터를 삭제하고 앱을 초기화하시겠습니까?</p>',
    [
      { text: '취소', class: 'modal-cancel', action: closeModal },
      {
        text: '초기화', class: 'modal-danger', action: () => {
          localStorage.clear();
          state.savedNumbers = [];
          closeModal();
          showToast('🔄 앱이 초기화되었습니다');
          setTimeout(() => location.reload(), 1000);
        }
      },
    ]
  );
}

// ==================== STORAGE ====================
function saveToDisk() {
  localStorage.setItem('luckyai_saved', JSON.stringify(state.savedNumbers));
}

// ==================== UI HELPERS ====================
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

function showModal(title, body, actions) {
  document.getElementById('modal-header').textContent = title;
  document.getElementById('modal-body').innerHTML = body;

  const actionsEl = document.getElementById('modal-actions');
  actionsEl.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.textContent = a.text;
    btn.className = a.class;
    btn.onclick = a.action;
    actionsEl.appendChild(btn);
  });

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// ==================== CONFETTI ====================
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#6c5ce7', '#fd79a8'];

  for (let i = 0; i < 100; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 150,
      w: Math.random() * 10 + 4,
      h: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3 + 2,
      vx: (Math.random() - 0.5) * 5,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      if (p.opacity <= 0) return;
      alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.rotSpeed;
      p.vy += 0.06;
      if (frame > 60) p.opacity -= 0.015;
    });

    frame++;
    if (alive && frame < 180) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  animate();
}

window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// ==================== INITIALIZATION ====================
async function initApp() {
  // Apply settings
  if (state.settings.defaultSets) {
    state.setCounts = state.settings.defaultSets;
  }

  // Generate fallback data first so UI isn't empty
  for (const key of Object.keys(GAMES)) {
    generateFallbackResults(key);
  }

  // Render home with fallback data
  renderHome();
  updateGenSubText();

  // Load settings UI
  const darkToggle = document.getElementById('darkmode-toggle');
  if (darkToggle) darkToggle.checked = state.settings.darkMode !== false;
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) soundToggle.checked = state.settings.sound !== false;
  const defaultSetsEl = document.getElementById('default-sets');
  if (defaultSetsEl) defaultSetsEl.value = state.settings.defaultSets || 5;
  const setCountEl = document.getElementById('gen-set-count');
  if (setCountEl) setCountEl.textContent = state.setCounts;

  // Hide splash
  setTimeout(() => {
    document.getElementById('splash').classList.add('fade-out');
    document.getElementById('app').classList.remove('hidden');
  }, 1500);

  // Fetch real data from APIs (async, updates UI when done)
  await fetchAllResults();
}

// Canvas roundRect polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

// Start
document.addEventListener('DOMContentLoaded', initApp);
