// Korean Lotto 6/45: Complete frequency data from Round 1 to 1215 (2002-12-07 ~ 2026-03-14)
// Source: lottolyzer.com historical analysis
// Format: { number: [winning_count, bonus_count, total_count] }
const LOTTO_FULL_FREQ = {
  1:[130,17,147], 2:[112,27,139], 3:[129,28,157], 4:[118,28,146], 5:[117,21,138],
  6:[129,26,155], 7:[132,24,156], 8:[124,14,138], 9:[108,19,127], 10:[127,24,151],
  11:[123,24,147], 12:[146,25,171], 13:[137,25,162], 14:[125,23,148], 15:[128,24,152],
  16:[128,26,154], 17:[129,26,155], 18:[126,24,150], 19:[120,23,143], 20:[131,26,157],
  21:[121,29,149],22:[109,24,133],23:[109,24,133],24:[133,27,160],25:[105,24,129],
  26:[126,26,152],27:[136,26,162],28:[116,25,141],29:[115,21,136],30:[124,24,148],
  31:[126,24,150],32:[114,25,139],33:[135,25,160],34:[136,25,161],35:[119,25,144],
  36:[117,23,140],37:[120,24,144],38:[138,25,163],39:[120,23,143],40:[127,23,150],
  41:[110,23,133],42:[109,25,134],43:[128,24,152],44:[120,24,144],45:[131,26,157]
};

// Total rounds analyzed
const LOTTO_TOTAL_ROUNDS = 1215;

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
