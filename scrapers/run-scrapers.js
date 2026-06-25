import { db } from './firebase-admin.js';
import { scrapeBerkeley } from './scrape-berkeley.js';
import { scrapeGoldenBear } from './scrape-golden-bear.js';
import { scrapeEmeryville } from './scrape-emeryville.js';
import { albanySchedule } from './albany-auto.js';
import { scrapeRoberts } from './scrape-roberts.js';
import { scrapeEastOakland } from './scrape-east-oakland.js';
import { scrapeElCerritoSplash } from './scrape-el-cerrito-splash.js';
import { scrapeDefremery } from './scrape-defremery.js';
import { scrapePiedmont } from './scrape-piedmont.js';
import { scrapeLions } from './scrape-lions.js';
import { scrapeRichmond } from './scrape-richmond.js';
import { scrapeGmail } from './scrape-gmail.js';

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

// Merge closureNotice fields onto existing documents without replacing the whole doc.
// Uses set+merge so the closureNotice field is touched without overwriting sessions.
// merge:true also handles dates that don't yet have a schedule document.
async function writeClosureNotices(notices) {
  const batch = db.batch();
  let count = 0;
  for (const [key, value] of Object.entries(notices)) {
    const ref = db.collection('schedules').doc(key);
    // Key is "poolId_YYYY-MM-DD". Include date + poolId so the query
    // where('date', '==', ds) can find docs created fresh by this function.
    const underscoreIdx = key.lastIndexOf('_');
    const poolId = key.slice(0, underscoreIdx);
    const date = key.slice(underscoreIdx + 1);
    batch.set(ref, { closureNotice: value.closureNotice, poolId, date }, { merge: true });
    count++;
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

  console.log('→ deFremery Pool (Oakland)...');
  const defremery = await scrapeDefremery(14);
  console.log(`  ${Object.keys(defremery).length} schedule entries`);

  console.log('→ Piedmont Community Pool...');
  const piedmont = await scrapePiedmont(14);
  console.log(`  ${Object.keys(piedmont).length} schedule entries`);

  console.log('→ Lions Pool (Oakland)...');
  const lions = await scrapeLions(14);
  console.log(`  ${Object.keys(lions).length} schedule entries`);

  console.log('→ Richmond Plunge...');
  const richmond = await scrapeRichmond(14);
  console.log(`  ${Object.keys(richmond).length} schedule entries`);

  const all = { ...berkeley, ...goldenBear, ...emeryville, ...albany, ...roberts, ...eastOakland, ...elCerritoSplash, ...defremery, ...piedmont, ...lions, ...richmond };
  console.log(`\nTotal: ${Object.keys(all).length} entries — writing to Firestore...`);

  const written = await writeToFirestore(all);
  console.log(`✓ ${written} documents written.`);

  console.log('\n→ Gmail (closure notices)...');
  const gmailNotices = await scrapeGmail();
  const noticeCount = Object.keys(gmailNotices).length;
  console.log(`  ${noticeCount} closure notice(s) found`);
  if (noticeCount > 0) {
    await writeClosureNotices(gmailNotices);
    console.log(`  ✓ Closure notices merged into Firestore.`);
  }

  console.log(`\n✓ Done.`);
}

main().catch(err => { console.error(err); process.exit(1); });
