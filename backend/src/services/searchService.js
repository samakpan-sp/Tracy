const SERPER_API_KEY = process.env.SERPER_API_KEY;

export async function searchWeb(query) {
  if (!SERPER_API_KEY) {
    throw new Error('Missing SERPER_API_KEY in backend .env');
  }

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });

  if (!res.ok) {
    throw new Error(`Search request failed with status ${res.status}`);
  }

  const data = await res.json();
  const organic = data.organic || [];

  return organic.slice(0, 5).map((r) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
  }));
}