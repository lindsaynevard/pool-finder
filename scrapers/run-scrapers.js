import { db } from './firebase-admin.js';
import { scrapeBerkeley } from './scrape-berkeley.js';
import { scrapeGoldenBear } from './scrape-golden-bear.js';
import { scrapeEmeryville } from './scrape-emeryville.js';
import { albanySchedule } from './albany-auto.js';
import { scrapeRoberts } from './scrape-roberts.js';
import { scrapeEastOakland } from './scrape-east-oakland.js';
import { scrapeElCerritoSplash } from './scrape-el-cerrito-splash.js';

async function writeToFirestore(data) {
  const batch = db.batch();
  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    const ref = db.collection('schedules').doc(key);
    batch.set(ref, value);
    count++;
    // Firestore batches max out at 500
    if (count % 499 === 0) {
      await batch.commit();
    }
  }
  await batch.commit();
  return count;
}

async function main() {
  console.log('Running scrapers...\n');

  console.log('→ West Campus + King Pool (Berkeley)...');
  const berkeley = await scrapeBerkeley(14);
  console.log(`  ${Object.keys(berkeley).length} schedule entries`);

  console.log('→ Golden Bear / Spieker (UC Berkeley)...');
  const goldenBear = await scrapeGoldenBear();
  console.log(`  ${Object.keys(goldenBear).length} schedule entries`);

  console.log('→ Emeryville ECCL...');
  const emeryville = await scrapeEmeryville(14);
  console.log(`  ${Object.keys(emeryville).length} schedule entries`);

  console.log('→ Albany (auto PDF scraper)...');
  const albany = await albanySchedule(14);
  console.log(`  ${Object.keys(albany).length} schedule entries`);

  console.log('→ Roberts Pool (East Bay Regional Parks)...');
  const roberts = await scrapeRoberts(14);
  console.log(`  ${Object.keys(roberts).length} schedule entries`);

  console.log('→ East Oakland Sports Center...');
  const eastOakland = await scrapeEastOakland(14);
  console.log(`  ${Object.keys(eastOakland).length} schedule entries`);

  console.log('→ El Cerrito Splash Park...');
  const elCerritoSplash = await scrapeElCerritoSplash(14);
  console.log(`  ${Object.keys(elCerritoSplash).length} schedule entries`);

  const all = { ...berkeley, ...goldenBear, ...emeryville, ...albany, ...roberts, ...eastOakland, ...elCerritoSplash };
  console.log(`\nTotal: ${Object.keys(all).length} entries — writing to Firestore...`);

  const written = await writeToFirestore(all);
  console.log(`\n✓ Done. ${written} documents written to Firestore.`);
}

main().catch(err => { console.error(err); process.exit(1); });
