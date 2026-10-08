// Proxy endpoint for the Emeryville ECCL schedule page.
// GitHub Actions' Azure IPs are blocked by CivicPlus (Emeryville's host),
// so CI fetches through here instead — Vercel Edge Functions use Cloudflare IPs,
// which are not blocked.
// Protected with a shared secret so nothing external can abuse this endpoint.

export const config = { runtime: 'edge' };

const TARGET = 'https://www.emeryville.org/Recreation/Fitness/Aquatics/Swim-For-Fitness';

export default async function handler(req) {
  const secret = req.headers.get('x-proxy-secret');
  if (!secret || secret !== process.env.PROXY_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const res = await fetch(TARGET, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.emeryville.org/',
      },
    });
    const html = await res.text();
    return new Response(html, {
      status: res.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 502 });
  }
}
