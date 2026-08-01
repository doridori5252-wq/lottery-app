// Korean Lotto 6/45: Complete frequency data from Round 1 to 1215 (2002-12-07 ~ 2026-03-14)
// Source: lottolyzer.com historical analysis
// Format: { number: [winning_count, bonus_count, total_count] }
const LOTTO_FULL_FREQ = {
  1:[133,18,151], 2:[114,27,141], 3:[132,29,161], 4:[121,28,149], 5:[117,21,138],
  6:[131,26,157], 7:[133,24,157], 8:[127,14,141], 9:[111,20,131], 10:[129,24,153],
  11:[124,24,148], 12:[148,25,173], 13:[141,26,167], 14:[128,23,151], 15:[133,25,158],
  16:[130,27,157], 17:[131,26,157], 18:[130,24,154], 19:[123,23,146], 20:[134,26,160],
  21:[122,29,150],22:[112,24,136],23:[110,24,134],24:[136,27,163],25:[107,26,133],
  26:[127,27,154],27:[137,27,164],28:[121,26,147],29:[118,22,140],30:[126,24,150],
  31:[131,25,156],32:[117,25,142],33:[136,26,162],34:[138,26,164],35:[121,25,146],
  36:[119,23,142],37:[122,24,146],38:[139,25,164],39:[122,23,145],40:[128,23,151],
  41:[113,25,138],42:[113,25,138],43:[129,24,153],44:[123,24,147],45:[134,27,161]
};

// Total rounds analyzed
const LOTTO_TOTAL_ROUNDS = 1234;

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
  {pair:[27,38],count:6},{pair:[15,19],count:5},{pair:[3,42],count:5},{pair:[13,28],count:5},{pair:[27,36],count:5},{pair:[7,9],count:5},{pair:[37,40],count:4},{pair:[6,28],count:4},{pair:[9,19],count:4},{pair:[8,31],count:4},{pair:[3,15],count:4},{pair:[25,31],count:4},{pair:[16,23],count:4},{pair:[16,31],count:4},{pair:[9,24],count:4},{pair:[1,31],count:3},{pair:[31,35],count:3},{pair:[2,20],count:3},{pair:[15,24],count:3},{pair:[15,36],count:3},{pair:[3,28],count:3},{pair:[8,28],count:3},{pair:[8,42],count:3},{pair:[9,42],count:3},{pair:[22,28],count:3},{pair:[28,42],count:3},{pair:[12,37],count:3},{pair:[13,37],count:3},{pair:[29,37],count:3},{pair:[24,30],count:3}
];
