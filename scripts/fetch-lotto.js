#!/usr/bin/env node
// Fetches latest Korean Lotto results and updates app.js + lotto-history.js
// Used by GitHub Actions weekly cron

const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, '..', 'js', 'app.js');
const HISTORY_JS = path.join(__dirname, '..', 'js', 'lotto-history.js');

// Try multiple sources to get Korean Lotto data
async function fetchLottoRound(round) {
  const lottoUrl = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;

  const sources = [
    // Source 1: Direct dhlottery API (works if run from KR IP)
    async () => {
      const res = await fetch(lottoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.dhlottery.co.kr/',
        },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      if (data.returnValue !== 'success') throw new Error('Not success');
      return data;
    },
    // Source 2: allorigins proxy
    async () => {
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(lottoUrl)}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.returnValue !== 'success') throw new Error('Not success');
      return data;
    },
    // Source 3: corsproxy.io
    async () => {
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(lottoUrl)}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.returnValue !== 'success') throw new Error('Not success');
      return data;
    },
    // Source 4: thingproxy
    async () => {
      const res = await fetch(`https://thingproxy.freeboard.io/fetch/${lottoUrl}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.returnValue !== 'success') throw new Error('Not success');
      return data;
    },
    // Source 5: proxy.cors.sh
    async () => {
      const res = await fetch(lottoUrl, {
        headers: { 'x-cors-api-key': 'temp_test', 'Origin': 'https://localhost' },
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (data.returnValue !== 'success') throw new Error('Not success');
      return data;
    },
  ];

  for (const source of sources) {
    try {
      return await source();
    } catch (e) {
      continue;
    }
  }
  return null;
}

// Scrape latest results from lottolyzer.com (accessible from non-KR IPs)
async function fetchFromLottolyzer(maxRound, minRound) {
  const results = [];
  const perPage = 20;
  const pages = Math.ceil((maxRound - minRound + 1) / perPage);

  for (let page = 1; page <= Math.min(pages, 5); page++) {
    try {
      const url = `https://en.lottolyzer.com/history/south-korea/6_slash_45-lotto/page/${page}/per-page/${perPage}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15000),
      });
      const html = await res.text();

      // Parse table rows — lottolyzer format:
      // <tr><td>1215</td><td>14 Mar 2026</td><td>13</td>...<td>45</td><td>39</td></tr>
      const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
      const rows = html.match(rowRegex) || [];

      for (const row of rows) {
        const cells = [];
        const cellRegex = /<td[^>]*>\s*([^<]+?)\s*<\/td>/gi;
        let m;
        while ((m = cellRegex.exec(row)) !== null) {
          cells.push(m[1].trim());
        }

        // Expect: [round, date, n1, n2, n3, n4, n5, n6, bonus]
        if (cells.length < 9) continue;
        const round = parseInt(cells[0]);
        if (isNaN(round) || round < minRound || round > maxRound) continue;

        const nums = cells.slice(2, 8).map(Number);
        const bonus = parseInt(cells[8]);
        if (nums.some(isNaN) || nums.some(n => n < 1 || n > 45)) continue;
        if (isNaN(bonus) || bonus < 1 || bonus > 45) continue;

        // Parse date (e.g. "14 Mar 2026")
        const dateStr = cells[1];
        const parsedDate = new Date(dateStr);
        const dateFormatted = isNaN(parsedDate)
          ? dateStr
          : parsedDate.toISOString().split('T')[0];

        results.push({
          round,
          date: dateFormatted,
          main: nums.sort((a, b) => a - b),
          special: bonus,
        });
      }
    } catch (e) {
      console.log(`  lottolyzer page ${page} failed:`, e.message);
    }
  }

  return results;
}

function parseLottoData(data) {
  const main = [
    data.drwtNo1, data.drwtNo2, data.drwtNo3,
    data.drwtNo4, data.drwtNo5, data.drwtNo6
  ].sort((a, b) => a - b);

  return {
    round: data.drwNo,
    date: data.drwNoDate,
    main,
    special: data.bnusNo,
  };
}

// Calculate latest round number
function getLatestRound() {
  const startDate = new Date('2002-12-07');
  const now = new Date();
  return Math.floor((now - startDate) / (7 * 24 * 60 * 60 * 1000));
}

// Read current static data from app.js
function getCurrentRounds() {
  const content = fs.readFileSync(APP_JS, 'utf-8');
  const match = content.match(/const STATIC_LOTTO_DATA = \[([\s\S]*?)\];/);
  if (!match) return [];

  const rounds = [];
  const regex = /round:(\d+)/g;
  let m;
  while ((m = regex.exec(match[1])) !== null) {
    rounds.push(parseInt(m[1]));
  }
  return rounds;
}

// Update STATIC_LOTTO_DATA in app.js
function updateAppJs(newEntries, existingContent) {
  const match = existingContent.match(/(const STATIC_LOTTO_DATA = \[)\n([\s\S]*?)(\];)/);
  if (!match) {
    console.log('Could not find STATIC_LOTTO_DATA in app.js');
    return existingContent;
  }

  // Parse existing entries
  const existingEntries = [];
  const entryRegex = /\{round:(\d+),date:'([^']+)',main:\[([^\]]+)\],special:(\d+)\}/g;
  let em;
  while ((em = entryRegex.exec(match[2])) !== null) {
    existingEntries.push({
      round: parseInt(em[1]),
      date: em[2],
      main: em[3].split(',').map(Number),
      special: parseInt(em[4]),
    });
  }

  // Merge new entries
  for (const entry of newEntries) {
    const idx = existingEntries.findIndex(e => e.round === entry.round);
    if (idx >= 0) {
      existingEntries[idx] = entry; // update existing
    } else {
      existingEntries.push(entry); // add new
    }
  }

  // Sort by round descending, keep latest 100
  existingEntries.sort((a, b) => b.round - a.round);
  const kept = existingEntries.slice(0, 100);

  // Format entries
  const lines = kept.map(e =>
    `  {round:${e.round},date:'${e.date}',main:[${e.main.join(',')}],special:${e.special}}`
  ).join(',\n');

  return existingContent.replace(
    /(const STATIC_LOTTO_DATA = \[)\n[\s\S]*?(\];)/,
    `$1\n${lines}\n$2`
  );
}

// Update frequency data in lotto-history.js
function updateFrequencyData(allResults) {
  const freq = {};
  for (let i = 1; i <= 45; i++) freq[i] = [0, 0, 0]; // [winning, bonus, total]

  for (const r of allResults) {
    for (const n of r.main) {
      freq[n][0]++;
      freq[n][2]++;
    }
    if (r.special) {
      freq[r.special][1]++;
      freq[r.special][2]++;
    }
  }

  const totalRounds = allResults.length > 0
    ? Math.max(...allResults.map(r => r.round))
    : 1215;

  const freqLines = [];
  for (let i = 1; i <= 45; i++) {
    freqLines.push(`  ${i}:[${freq[i].join(',')}]`);
  }

  return `// Korean Lotto 6/45: Complete frequency data from Round 1 to ${totalRounds}
// Auto-updated by GitHub Actions
// Format: { number: [winning_count, bonus_count, total_count] }
const LOTTO_FULL_FREQ = {
${freqLines.join(',\n')}
};

// Total rounds analyzed
const LOTTO_TOTAL_ROUNDS = ${totalRounds};

// Pre-computed sorted rankings
const LOTTO_HOT_NUMS = Object.entries(LOTTO_FULL_FREQ)
  .sort((a, b) => b[1][0] - a[1][0])
  .map(e => parseInt(e[0]));

const LOTTO_COLD_NUMS = Object.entries(LOTTO_FULL_FREQ)
  .sort((a, b) => a[1][0] - b[1][0])
  .map(e => parseInt(e[0]));

// Hot bonus numbers
const LOTTO_HOT_BONUS = Object.entries(LOTTO_FULL_FREQ)
  .sort((a, b) => b[1][1] - a[1][1])
  .map(e => parseInt(e[0]));
`;
}

async function main() {
  console.log('🔍 Checking for new Korean Lotto results...');

  const latestRound = getLatestRound();
  const currentRounds = getCurrentRounds();
  const maxCurrent = currentRounds.length > 0 ? Math.max(...currentRounds) : 0;

  console.log(`Latest estimated round: ${latestRound}`);
  console.log(`Current max round in data: ${maxCurrent}`);

  if (maxCurrent >= latestRound) {
    console.log('✅ Data is already up to date!');
    return;
  }

  // Fetch missing rounds
  const newEntries = [];
  for (let round = maxCurrent + 1; round <= latestRound; round++) {
    console.log(`Fetching round ${round}...`);
    const data = await fetchLottoRound(round);
    if (data) {
      const entry = parseLottoData(data);
      newEntries.push(entry);
      console.log(`  ✅ Round ${round}: ${entry.main.join(',')} + ${entry.special}`);
    } else {
      console.log(`  ❌ Round ${round}: could not fetch`);
      // Try scraping from lottolyzer as last resort
      break;
    }
  }

  if (newEntries.length === 0) {
    console.log('⚠️ Direct APIs failed. Trying lottolyzer.com scraping...');
    try {
      const lottolyzerData = await fetchFromLottolyzer(latestRound, maxCurrent + 1);
      for (const entry of lottolyzerData) {
        if (entry.round > maxCurrent) {
          newEntries.push(entry);
          console.log(`  ✅ [lottolyzer] Round ${entry.round}: ${entry.main.join(',')} + ${entry.special}`);
        }
      }
    } catch (e) {
      console.log('  Lottolyzer failed:', e.message);
    }

    if (newEntries.length === 0) {
      console.log('❌ No new data available from any source. Exiting.');
      return;
    }
  }

  // Update app.js
  console.log(`\n📝 Updating app.js with ${newEntries.length} new rounds...`);
  let appContent = fs.readFileSync(APP_JS, 'utf-8');
  appContent = updateAppJs(newEntries, appContent);
  fs.writeFileSync(APP_JS, appContent, 'utf-8');

  // Update frequency data if we have enough new data
  // Read all current static data + new entries for frequency calculation
  const allStaticMatch = appContent.match(/const STATIC_LOTTO_DATA = \[([\s\S]*?)\];/);
  if (allStaticMatch) {
    // For frequency update, we only update the total rounds count
    let historyContent = fs.readFileSync(HISTORY_JS, 'utf-8');
    const newMax = Math.max(latestRound, maxCurrent, ...newEntries.map(e => e.round));
    historyContent = historyContent.replace(
      /const LOTTO_TOTAL_ROUNDS = \d+;/,
      `const LOTTO_TOTAL_ROUNDS = ${newMax};`
    );

    // Update frequency counts for new numbers
    for (const entry of newEntries) {
      for (const num of entry.main) {
        // Increment winning count for this number
        const freqRegex = new RegExp(`(${num}:\\[)(\\d+),(\\d+),(\\d+)(\\])`);
        historyContent = historyContent.replace(freqRegex, (match, prefix, win, bonus, total, suffix) => {
          return `${prefix}${parseInt(win) + 1},${bonus},${parseInt(total) + 1}${suffix}`;
        });
      }
      if (entry.special) {
        // Increment bonus count
        const bonusRegex = new RegExp(`(${entry.special}:\\[)(\\d+),(\\d+),(\\d+)(\\])`);
        historyContent = historyContent.replace(bonusRegex, (match, prefix, win, bonus, total, suffix) => {
          return `${prefix}${win},${parseInt(bonus) + 1},${parseInt(total) + 1}${suffix}`;
        });
      }
    }

    // Recompute LOTTO_TOP_PAIRS from updated STATIC_LOTTO_DATA
    const allEntries = [];
    const entryRegex2 = /\{round:(\d+),date:'([^']+)',main:\[([^\]]+)\],special:(\d+)\}/g;
    let em2;
    while ((em2 = entryRegex2.exec(appContent)) !== null) {
      allEntries.push({ main: em2[3].split(',').map(Number) });
    }
    const pairCount = {};
    for (const r of allEntries) {
      const nums = [...r.main].sort((a, b) => a - b);
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const k = `${nums[i]},${nums[j]}`;
          pairCount[k] = (pairCount[k] || 0) + 1;
        }
      }
    }
    const topPairs = Object.entries(pairCount)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([k, c]) => `{pair:[${k}],count:${c}}`);

    const pairsLine = `const LOTTO_TOP_PAIRS = [\n  ${topPairs.join(',')}\n];`;
    historyContent = historyContent.replace(
      /const LOTTO_TOP_PAIRS = \[[\s\S]*?\];/,
      pairsLine
    );

    fs.writeFileSync(HISTORY_JS, historyContent, 'utf-8');
    console.log(`📊 Updated frequency data + top ${topPairs.length} pairs`);
  }

  // Update SW cache version with today's date
  const swPath = path.join(__dirname, '..', 'sw.js');
  let swContent = fs.readFileSync(swPath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  swContent = swContent.replace(
    /const CACHE_VERSION = '[^']+';/,
    `const CACHE_VERSION = '${today}';`
  );
  fs.writeFileSync(swPath, swContent, 'utf-8');
  console.log(`🔄 SW cache version updated to ${today}`);

  console.log(`\n🎉 Done! ${newEntries.length} new rounds added.`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
