// Korean Lotto 6/45: Complete frequency data from Round 1 to 1215 (2002-12-07 ~ 2026-03-14)
// Source: lottolyzer.com historical analysis
// Format: { number: [winning_count, bonus_count, total_count] }
const LOTTO_FULL_FREQ = {
  1:[133,18,151], 2:[115,27,142], 3:[132,29,161], 4:[121,28,149], 5:[117,21,138],
  6:[132,26,158], 7:[134,24,158], 8:[127,15,142], 9:[111,20,131], 10:[130,25,155],
  11:[126,24,150], 12:[149,25,174], 13:[143,26,169], 14:[128,23,151], 15:[134,25,159],
  16:[130,27,157], 17:[131,26,157], 18:[132,24,156], 19:[123,23,146], 20:[135,27,162],
  21:[123,29,151],22:[113,25,138],23:[111,24,135],24:[136,27,163],25:[107,26,133],
  26:[127,27,154],27:[137,27,164],28:[121,26,147],29:[119,22,141],30:[126,24,150],
  31:[131,25,156],32:[119,25,144],33:[137,26,163],34:[140,26,166],35:[121,25,146],
  36:[120,24,144],37:[123,24,147],38:[141,25,166],39:[123,23,146],40:[129,23,152],
  41:[113,25,138],42:[114,25,139],43:[130,24,154],44:[123,24,147],45:[134,27,161]
};

// Total rounds analyzed
const LOTTO_TOTAL_ROUNDS = 1239;

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
  {pair:[27,38],count:6},{pair:[37,40],count:5},{pair:[15,19],count:5},{pair:[3,42],count:5},{pair:[13,28],count:5},{pair:[27,36],count:5},{pair:[7,9],count:5},{pair:[23,40],count:4},{pair:[6,28],count:4},{pair:[9,19],count:4},{pair:[8,31],count:4},{pair:[3,15],count:4},{pair:[25,31],count:4},{pair:[16,23],count:4},{pair:[16,31],count:4},{pair:[9,24],count:4},{pair:[11,36],count:3},{pair:[22,32],count:3},{pair:[13,18],count:3},{pair:[13,38],count:3},{pair:[13,42],count:3},{pair:[18,38],count:3},{pair:[32,42],count:3},{pair:[38,42],count:3},{pair:[10,20],count:3},{pair:[10,23],count:3},{pair:[20,37],count:3},{pair:[12,29],count:3},{pair:[29,38],count:3},{pair:[6,7],count:3}
];
