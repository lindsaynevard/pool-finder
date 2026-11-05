import { db } from './firebase-admin.js';
import { scrapeRainBerkeley } from './scrape-rain-berkeley.js';

async function main() {
  console.log('Running Berkeley Marina rain check...');
  try {
    const rain = await scrapeRainBerkeley();
    await db.collection('rain_advisory').doc('berkeley-marina').set(rain);
    console.log(`✓ Advisory written (level: ${rain.level}, lastRain: ${rain.lastRainDate ?? 'none'})`);
  } catch (err) {
    console.error(`✗ Rain check failed: ${err.message}`);
    process.exit(1);
  }
}

main();
