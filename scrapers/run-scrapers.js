import { db } from './firebase-admin.js';
import { scrapeBerkeley } from './scrape-berkeley.js';
import { scrapeGoldenBear } from './scrape-golden-bear.js';
import { scrapeEmeryville } from './scrape-emeryville.js';
import { albanySchedule } from './albany-auto.js';
import { scrapeRoberts } from './scrape-roberts.js';
import { scrapeEastOakland } from './scrape-east-oakland.js';
import { scrapeElCerritoSplash } from './scrape-el-cerrito-splash.js';
import { scrapeElCerritoPool } from './scrape-el-cerrito-pool.js';
import { scrapeDefremery } from './scrape-defremery.js';
import { scrapePiedmont } from './scrape-piedmont.js';
import { scrapeLions } from './scrape-lions.js';
import { scrapeRichmond } from './scrape-richmond.js';
import { scrapeRichmondSwimCenter } from './scrape-richmond-swim-center.js';
import { scrapeMills } from './scrape-mills.js';
import { scrapeBerkeleyMarina } from './scrape-berkeley-marina.js';
import { scrapeGmail } from './scrape-gmail.js';

// Fetch doc IDs that have been manually edited and should not be overwritten by scrapers.
async function getManualOverrides() {
  const snap = await db.collection('schedules').where('manualOverride', '==', true).get();
  const overrides = new Set();
  snap.forEach(d => overrides.add(d.id));
  return overrides;
}

async function writeToFirestore(data, overrides = new Set()) {
  const batch = db.batch();
  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    if (overrides.has(key)) {
      console.log(`  Skipping ${key} (manualOverride)`);
      continue;
    }
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
// After each scraper runs, write a metadata doc so the app can detect
// schedule gaps (scheduledThrough < viewed date) and staleness (lastRun > 25h ago).
async function writePoolMeta(scraperResults, scraperFile) {
  if (Object.keys(scraperResults).length === 0) return;

  const now = new Date().toISOString();
  const poolMap = {};

  for (const [key, value] of Object.entries(scraperResults)) {
    const underscoreIdx = key.lastIndexOf('_');
    const poolId = key.slice(0, underscoreIdx);
    const date = key.slice(underscoreIdx + 1);
    if (!poolMap[poolId]) poolMap[poolId] = { dates: [], sessionCount: 0 };
    poolMap[poolId].dates.push(date);
    poolMap[poolId].sessionCount += (value.sessions?.length || 0);
  }

  const batch = db.batch();
  for (const [poolId, { dates, sessionCount }] of Object.entries(poolMap)) {
    const ref = db.collection('pool_meta').doc(poolId);
    batch.set(ref, {
      poolId,
      scheduledThrough: [...dates].sort().at(-1),
      sessionCount,
      scraperFile,
      lastRun: now,
    });
  }
  await batch.commit();
}

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

async function run(label, fn) {
  console.log(`→ ${label}...`);
  try {
    const result = await fn();
    console.log(`  ${Object.keys(result).length} schedule entries`);
    return result;
  } catch (err) {
    console.error(`  ✗ ${label} failed: ${err.message}`);
    return {};
  }
}

async function main() {
  console.log('Running scrapers...\n');

  const berkeley         = await run('West Campus + King Pool (Berkeley)', () => scrapeBerkeley(14));
  const goldenBear       = await run('Golden Bear / Spieker (UC Berkeley)', () => scrapeGoldenBear());
  const emeryville       = await run('Emeryville ECCL', () => scrapeEmeryville(14));
  const albany           = await run('Albany (auto PDF scraper)', () => albanySchedule(14));
  const roberts          = await run('Roberts Pool (East Bay Regional Parks)', () => scrapeRoberts(14));
  const eastOakland      = await run('East Oakland Sports Center', () => scrapeEastOakland(14));
  const elCerritoSplash  = await run('El Cerrito Splash Park', () => scrapeElCerritoSplash(14));
  const elCerritoPool    = await run('El Cerrito Swim Center (Fitness Swim)', () => scrapeElCerritoPool(14));
  const defremery        = await run('deFremery Pool (Oakland)', () => scrapeDefremery(14));
  const piedmont         = await run('Piedmont Community Pool', () => scrapePiedmont(14));
  const lions            = await run('Lions Pool (Oakland)', () => scrapeLions(14));
  const richmond         = await run('Richmond Plunge', () => scrapeRichmond(14));
  const richmondSwimCenter = await run('Richmond Swim Center (RSC)', () => scrapeRichmondSwimCenter(14));
  const mills              = await run('Trefethen Aquatic Center (Mills/NU Oakland)', () => scrapeMills(14));
  const berkeleyMarina     = await run('Berkeley Marina (NOAA tides)', () => scrapeBerkeleyMarina(14));

  const all = { ...berkeley, ...goldenBear, ...emeryville, ...albany, ...roberts, ...eastOakland, ...elCerritoSplash, ...elCerritoPool, ...defremery, ...piedmont, ...lions, ...richmond, ...richmondSwimCenter, ...mills, ...berkeleyMarina };
  console.log(`\nTotal: ${Object.keys(all).length} entries — writing to Firestore...`);

  const overrides = await getManualOverrides();
  if (overrides.size > 0) console.log(`  Protecting ${overrides.size} manually overridden doc(s).`);
  const written = await writeToFirestore(all, overrides);
  console.log(`✓ ${written} documents written.`);

  console.log('\n→ Writing pool metadata...');
  await writePoolMeta(berkeley,          'scrape-berkeley.js');
  await writePoolMeta(goldenBear,        'scrape-golden-bear.js');
  await writePoolMeta(emeryville,        'scrape-emeryville.js');
  await writePoolMeta(albany,            'albany-auto.js');
  await writePoolMeta(roberts,           'scrape-roberts.js');
  await writePoolMeta(eastOakland,       'scrape-east-oakland.js');
  await writePoolMeta(elCerritoSplash,   'scrape-el-cerrito-splash.js');
  await writePoolMeta(elCerritoPool,     'scrape-el-cerrito-pool.js');
  await writePoolMeta(defremery,         'scrape-defremery.js');
  await writePoolMeta(piedmont,          'scrape-piedmont.js');
  await writePoolMeta(lions,             'scrape-lions.js');
  await writePoolMeta(richmond,          'scrape-richmond.js');
  await writePoolMeta(richmondSwimCenter,'scrape-richmond-swim-center.js');
  await writePoolMeta(mills,            'scrape-mills.js');
  await writePoolMeta(berkeleyMarina,   'scrape-berkeley-marina.js');
  console.log('  ✓ Pool metadata written.');

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
