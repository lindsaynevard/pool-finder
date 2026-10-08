// Fetches the raw Emeryville schedule page and saves it locally.
// Run on a schedule from the Mac (which has a residential IP) since
// CI's Azure IPs are blocked by Emeryville's host. CI reads this file
// and handles the Claude AI parsing step using its ANTHROPIC_API_KEY secret.
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const OUTPUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '.emeryville-raw-page.html');
const URL = 'https://www.emeryville.org/Recreation/Fitness/Aquatics/Swim-For-Fitness';

const res = await fetch(URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
});

if (!res.ok) {
  console.error(`Emeryville fetch failed: HTTP ${res.status}`);
  process.exit(1);
}

const html = await res.text();
writeFileSync(OUTPUT, html, 'utf8');
console.log(`Saved ${html.length} bytes`);
