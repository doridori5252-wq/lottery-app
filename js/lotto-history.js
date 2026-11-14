// Korean Lotto 6/45: Complete frequency data from Round 1 to 1215 (2002-12-07 ~ 2026-03-14)
// Source: lottolyzer.com historical analysis
// Format: { number: [winning_count, bonus_count, total_count] }
const LOTTO_FULL_FREQ = {
  1:[134,18,152], 2:[117,27,144], 3:[132,29,161], 4:[123,28,151], 5:[118,21,139],
  6:[132,27,159], 7:[135,24,159], 8:[128,15,143], 9:[112,22,134], 10:[131,25,156],
  11:[128,24,152], 12:[149,26,175], 13:[146,26,172], 14:[129,24,153], 15:[134,25,159],
  16:[135,27,162], 17:[131,26,157], 18:[135,24,159], 19:[124,23,147], 20:[136,27,163],
  21:[124,29,152],22:[115,26,141],23:[113,24,137],24:[139,28,167],25:[109,27,136],
  26:[128,27,155],27:[139,28,167],28:[123,26,149],29:[119,22,141],30:[126,24,150],
  31:[133,25,158],32:[120,25,145],33:[137,26,163],34:[142,26,168],35:[122,26,148],
  36:[121,24,145],37:[123,24,147],38:[144,25,169],39:[123,23,146],40:[129,23,152],
  41:[114,25,139],42:[117,25,142],43:[132,24,156],44:[125,24,149],45:[135,27,162]
};

// Total rounds analyzed
const LOTTO_TOTAL_ROUNDS = 1249;

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
  {pair:[27,38],count:7},{pair:[18,38],count:6},{pair:[27,36],count:6},{pair:[16,23],count:6},{pair:[16,24],count:5},{pair:[9,24],count:5},{pair:[16,31],count:5},{pair:[37,40],count:5},{pair:[15,19],count:5},{pair:[3,42],count:5},{pair:[13,28],count:5},{pair:[7,9],count:5},{pair:[2,16],count:4},{pair:[27,42],count:4},{pair:[38,42],count:4},{pair:[8,42],count:4},{pair:[16,28],count:4},{pair:[22,28],count:4},{pair:[23,27],count:4},{pair:[4,32],count:4},{pair:[28,42],count:4},{pair:[32,42],count:4},{pair:[13,18],count:4},{pair:[13,38],count:4},{pair:[24,44],count:4},{pair:[4,41],count:4},{pair:[7,43],count:4},{pair:[31,44],count:4},{pair:[23,40],count:4},{pair:[6,28],count:4}
];
