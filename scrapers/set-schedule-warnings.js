// One-time script to set scheduleWarning on pool_meta docs for pools
// whose schedules we cannot currently verify (Oakland city website returns 403).
// Run once: node scrapers/set-schedule-warnings.js
// To clear a warning later: set scheduleWarning to null and run again.

import { db } from './firebase-admin.js';

const WARNINGS = {
  'defremery':        "Hours unverified — Oakland's website is unavailable. Check oaklandca.gov before visiting.",
  'lions':            "Hours unverified — Oakland's website is unavailable. Check oaklandca.gov before visiting.",
  'east-oakland-pool':"Hours unverified — Oakland's website is unavailable. Check oaklandca.gov before visiting.",
};

async function main() {
  const batch = db.batch();
  for (const [poolId, warning] of Object.entries(WARNINGS)) {
    const ref = db.collection('pool_meta').doc(poolId);
    batch.set(ref, { scheduleWarning: warning }, { merge: true });
    console.log(`  Set warning on ${poolId}`);
  }
  await batch.commit();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
