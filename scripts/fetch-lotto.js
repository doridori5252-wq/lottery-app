#!/usr/bin/env node
// Fetches latest Korean Lotto results and updates app.js + lotto-history.js
// Used by GitHub Actions weekly cron

const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, '..', 'js', 'app.js');
const HISTORY_JS = path.join(__dirname, '..', 'js', 'lotto-history.js');

// Try multiple sources to get Korean Lotto data
async function fetchLottoRound(round) {
  const sources = [
    // Source 1: Direct dhlottery API
    async () => {
      const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
      });
      const data = await res.json();
      if (data.returnValue !== 'success') throw new Error('Not success');
      return data;
    },
    // Source 2: allorigins proxy
    async () => {
      const lottoUrl = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
      const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(lottoUrl)}`);
      const data = await res.json();
      if (data.returnValue !== 'success') throw new Error('Not success');
      return data;
    },
    // Source 3: corsproxy
    async () => {
      const lottoUrl = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(lottoUrl)}`);
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
    console.log('⚠️ Could not fetch any new rounds from APIs.');
    console.log('Trying lottolyzer.com...');

    // Fallback: try to get from lottolyzer
    try {
      const res = await fetch('https://en.lottolyzer.com/history/south-korea/6_slash_45-lotto');
      const html = await res.text();

      // Parse the HTML for draw data
      // Look for patterns like: round number, date, and 6 numbers + bonus
      const drawRegex = /(\d{4})\s*<\/td>\s*<td[^>]*>\s*(\d{4}-\d{2}-\d{2})/g;
      let match;
      while ((match = drawRegex.exec(html)) !== null) {
        const round = parseInt(match[1]);
        if (round > maxCurrent && round <= latestRound) {
          console.log(`  Found round ${round} on lottolyzer`);
        }
      }
    } catch (e) {
      console.log('  Lottolyzer fetch failed:', e.message);
    }

    if (newEntries.length === 0) {
      console.log('❌ No new data available. Exiting.');
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

    fs.writeFileSync(HISTORY_JS, historyContent, 'utf-8');
    console.log('📊 Updated frequency data');
  }

  // Update SW cache version
  const swPath = path.join(__dirname, '..', 'sw.js');
  let swContent = fs.readFileSync(swPath, 'utf-8');
  const vMatch = swContent.match(/luckyai-v(\d+)/);
  if (vMatch) {
    const newVersion = parseInt(vMatch[1]) + 1;
    swContent = swContent.replace(/luckyai-v\d+/, `luckyai-v${newVersion}`);
    fs.writeFileSync(swPath, swContent, 'utf-8');
    console.log(`🔄 SW cache version bumped to v${newVersion}`);
  }

  console.log(`\n🎉 Done! ${newEntries.length} new rounds added.`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
