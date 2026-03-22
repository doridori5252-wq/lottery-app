// Netlify Serverless Function: Korean Lotto API Proxy
// Tries multiple approaches to fetch Korean lottery data

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const round = event.queryStringParameters && event.queryStringParameters.round;
  if (!round || isNaN(round)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing or invalid round parameter' }),
    };
  }

  const lottoUrl = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;

  // Try multiple approaches
  const attempts = [
    // Attempt 1: Direct fetch
    async () => {
      const res = await fetch(lottoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.dhlottery.co.kr/',
        },
      });
      return await res.text();
    },
    // Attempt 2: Via allorigins proxy
    async () => {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(lottoUrl)}`;
      const res = await fetch(proxyUrl);
      return await res.text();
    },
    // Attempt 3: Via corsproxy.io
    async () => {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(lottoUrl)}`;
      const res = await fetch(proxyUrl);
      return await res.text();
    },
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      const text = await attempts[i]();
      const data = JSON.parse(text); // will throw if not valid JSON
      if (data.returnValue === 'success' || data.drwtNo1) {
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }
    } catch (e) {
      // Continue to next attempt
    }
  }

  return {
    statusCode: 502,
    headers,
    body: JSON.stringify({ error: 'All fetch attempts failed for round ' + round }),
  };
};
