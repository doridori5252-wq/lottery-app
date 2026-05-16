// Korean Lotto 6/45: Complete frequency data from Round 1 to 1215 (2002-12-07 ~ 2026-03-14)
// Source: lottolyzer.com historical analysis
// Format: { number: [winning_count, bonus_count, total_count] }
const LOTTO_FULL_FREQ = {
  1:[131,17,148], 2:[113,27,140], 3:[131,28,159], 4:[119,28,147], 5:[117,21,138],
  6:[130,26,156], 7:[132,24,156], 8:[125,14,139], 9:[108,20,128], 10:[129,24,153],
  11:[124,24,148], 12:[146,25,171], 13:[138,25,163], 14:[126,23,149], 15:[131,24,155],
  16:[129,26,155], 17:[130,26,156], 18:[128,24,152], 19:[120,23,143], 20:[133,26,159],
  21:[121,29,149],22:[110,24,134],23:[110,24,134],24:[134,27,161],25:[105,26,131],
  26:[126,27,153],27:[136,26,162],28:[119,25,144],29:[116,21,137],30:[125,24,149],
  31:[128,25,153],32:[117,25,142],33:[136,25,161],34:[136,26,162],35:[119,25,144],
  36:[118,23,141],37:[120,24,144],38:[138,25,163],39:[122,23,145],40:[127,23,150],
  41:[111,24,135],42:[110,25,135],43:[128,24,152],44:[120,24,144],45:[133,26,159]
};

// Total rounds analyzed
const LOTTO_TOTAL_ROUNDS = 1223;

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
  {pair:[27,38],count:6},{pair:[27,36],count:5},{pair:[7,9],count:5},{pair:[13,28],count:4},{pair:[3,42],count:4},{pair:[8,31],count:4},{pair:[3,15],count:4},{pair:[25,31],count:4},{pair:[16,23],count:4},{pair:[16,31],count:4},{pair:[9,24],count:4},{pair:[16,32],count:3},{pair:[4,32],count:3},{pair:[4,41],count:3},{pair:[11,17],count:3},{pair:[6,18],count:3},{pair:[6,28],count:3},{pair:[2,28],count:3},{pair:[1,28],count:3},{pair:[15,45],count:3},{pair:[28,31],count:3},{pair:[10,15],count:3},{pair:[3,24],count:3},{pair:[14,23],count:3},{pair:[15,19],count:3},{pair:[15,27],count:3},{pair:[15,33],count:3},{pair:[30,33],count:3},{pair:[23,27],count:3},{pair:[23,40],count:3}
];
