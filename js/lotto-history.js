// Korean Lotto 6/45: Complete frequency data from Round 1 to 1215 (2002-12-07 ~ 2026-03-14)
// Source: lottolyzer.com historical analysis
// Format: { number: [winning_count, bonus_count, total_count] }
const LOTTO_FULL_FREQ = {
  1:[131,17,148], 2:[113,27,140], 3:[131,28,159], 4:[120,28,148], 5:[117,21,138],
  6:[131,26,157], 7:[132,24,156], 8:[126,14,140], 9:[110,20,130], 10:[129,24,153],
  11:[124,24,148], 12:[146,25,171], 13:[139,25,164], 14:[126,23,149], 15:[131,24,155],
  16:[129,26,155], 17:[131,26,157], 18:[129,24,153], 19:[121,23,144], 20:[133,26,159],
  21:[122,29,150],22:[110,24,134],23:[110,24,134],24:[134,27,161],25:[106,26,132],
  26:[127,27,154],27:[137,26,163],28:[120,26,146],29:[116,21,137],30:[125,24,149],
  31:[128,25,153],32:[117,25,142],33:[136,26,162],34:[136,26,162],35:[119,25,144],
  36:[118,23,141],37:[120,24,144],38:[138,25,163],39:[122,23,145],40:[127,23,150],
  41:[112,25,137],42:[111,25,136],43:[128,24,152],44:[121,24,145],45:[134,26,160]
};

// Total rounds analyzed
const LOTTO_TOTAL_ROUNDS = 1226;

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

// Pre-computed top co-occurring pairs (recent 51 rounds, auto-updated by GitHub Actions)
// Format: { pair: [a, b], count: N }
const LOTTO_TOP_PAIRS = [
  {pair:[27,38],count:6},{pair:[13,28],count:5},{pair:[27,36],count:5},{pair:[7,9],count:5},{pair:[6,28],count:4},{pair:[9,19],count:4},{pair:[3,42],count:4},{pair:[8,31],count:4},{pair:[3,15],count:4},{pair:[25,31],count:4},{pair:[16,23],count:4},{pair:[16,31],count:4},{pair:[9,24],count:4},{pair:[4,17],count:3},{pair:[6,17],count:3},{pair:[8,41],count:3},{pair:[9,21],count:3},{pair:[9,27],count:3},{pair:[27,45],count:3},{pair:[16,32],count:3},{pair:[4,32],count:3},{pair:[4,41],count:3},{pair:[11,17],count:3},{pair:[6,18],count:3},{pair:[2,28],count:3},{pair:[1,28],count:3},{pair:[15,45],count:3},{pair:[28,31],count:3},{pair:[10,15],count:3},{pair:[3,24],count:3}
];
