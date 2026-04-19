// Korean Lotto 6/45: Complete frequency data from Round 1 to 1215 (2002-12-07 ~ 2026-03-14)
// Source: lottolyzer.com historical analysis
// Format: { number: [winning_count, bonus_count, total_count] }
const LOTTO_FULL_FREQ = {
  1:[131,17,148], 2:[113,27,140], 3:[131,28,159], 4:[118,28,146], 5:[117,21,138],
  6:[129,26,155], 7:[132,24,156], 8:[125,14,139], 9:[108,19,127], 10:[129,24,153],
  11:[123,24,147], 12:[146,25,171], 13:[137,25,162], 14:[126,23,149], 15:[131,24,155],
  16:[128,26,154], 17:[129,26,155], 18:[126,24,150], 19:[120,23,143], 20:[132,26,158],
  21:[121,29,149],22:[109,24,133],23:[110,24,134],24:[134,27,161],25:[105,26,131],
  26:[126,26,152],27:[136,26,162],28:[118,25,143],29:[116,21,137],30:[124,24,148],
  31:[128,25,153],32:[115,25,140],33:[135,25,160],34:[136,25,161],35:[119,25,144],
  36:[117,23,140],37:[120,24,144],38:[138,25,163],39:[121,23,144],40:[127,23,150],
  41:[110,24,134],42:[110,25,135],43:[128,24,152],44:[120,24,144],45:[133,26,159]
};

// Total rounds analyzed
const LOTTO_TOTAL_ROUNDS = 1219;

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
  {pair:[27,38],count:6},{pair:[27,36],count:5},{pair:[7,9],count:5},{pair:[25,31],count:4},{pair:[16,23],count:4},{pair:[16,31],count:4},{pair:[9,24],count:4},{pair:[15,19],count:3},{pair:[15,27],count:3},{pair:[15,33],count:3},{pair:[30,33],count:3},{pair:[8,31],count:3},{pair:[23,27],count:3},{pair:[23,40],count:3},{pair:[7,27],count:3},{pair:[17,27],count:3},{pair:[35,39],count:3},{pair:[6,27],count:3},{pair:[27,42],count:3},{pair:[3,27],count:3},{pair:[3,42],count:3},{pair:[1,4],count:3},{pair:[23,31],count:3},{pair:[16,28],count:3},{pair:[3,6],count:3},{pair:[6,29],count:3},{pair:[12,40],count:3},{pair:[33,37],count:3},{pair:[37,40],count:3},{pair:[9,35],count:3}
];
