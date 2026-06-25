# Pool App — To-Do

## Priority

- [x] Update schedule to reflect holiday closures posted on pool websites
  - Berkeley (King + West Campus): reads closure dates live from the schedule PDF linked on each pool's page
  - Emeryville: reads closure dates live from website
  - El Cerrito: reads closure dates live from website
  - East Oakland: writes a closure notice entry instead of silently skipping closed dates
  - Albany: already correct — Claude AI parses closedDates from the PDF
  - Golden Bear: already correct — schedule is date-specific, not weekly
  - Roberts: no live closure data available on their website — closures may not show

---

## Up Next

### Core features
- [ ] Wire up per-user preferences in Firestore (pool order, active/inactive pools) — Settings tab shows placeholder rows for these but they don't save or load anything yet
- [ ] Build onboarding flow: set location → pick pools → set order
- [ ] Build My Pools screen (Lap Order / Family Order tabs)
- [ ] Build Settings screen
- [ ] Add a way for users to flag issues

### Scrapers to add or fix
- [ ] Richmond Swim Center (RSC) at 4300 Cutting Blvd — second Richmond pool found in the same PDF as the Plunge; not yet in app
- [ ] Roberts Pool — scraper exists but no live closure data available from their website
- [ ] East Oakland Sports Center — scraper exists but closure dates are hardcoded (Oakland city website blocks automated access)
- [ ] "Diamond Pool (Oakland)" — cannot find this pool in Oakland's official pool list; may need to clarify which pool this refers to

### Gmail closure notice coverage
- [ ] Verify Piedmont + El Cerrito emails surface correctly once those pools send closure notices

---

## Done

- Sign-in screen (Google auth)
- Schedule screen: time-first layout, Lap/Family toggle, day navigation, session type tooltips, freshness banner
- Daily scraper — now 11 scrapers, ~185 Firestore entries per run (added DeFremery, Piedmont, Lions, Richmond Plunge)
- Figma wireframes V3 complete (10 screens)
- Vercel + GitHub auto-deploy connected
- Albany PDF cache system with hash-check (only calls Claude API when PDF changes)
- Bottom sheet UI — layout fixed (no longer stretches full screen; stays within app bounds)
- King Pool + West Campus July 3 closure verified in Firestore (scraper reads closure dates live from Berkeley PDF)
- My Pools tab now filters correctly — lap-only pools (Emeryville, Golden Bear) don't appear in Family mode; family-only pools (Roberts, East Oakland, El Cerrito) don't appear in Lap mode
- Pool detail sheet now shows email alert status for every pool + "View on Maps" button
- Gmail scraper bug fixed: was writing lesson-registration email content as false closure notices; now filters to dates within the 14-day window and verifies the notice text actually contains a closure keyword
- DeFremery Pool added to app with scraper (Mon–Fri 12:30–1:30 PM, Oakland holiday closures from live website)
- Piedmont Community Pool added to app with scraper (June 8 – July 19, competition pool + activity pool)
- Fixed duplicate sessions (e.g. King Pool showing twice on July 4): deduplicate in scraper before writing to Firestore, and in Schedule.jsx when reading — pushed to GitHub
- **Gmail scraper** — live and running on GitHub Actions
  - OAuth token obtained for poolfinderalerts@gmail.com
  - Reads inbox via Gmail REST API directly (bypasses googleapis library bug on GitHub Actions runners)
  - Matches sender emails to pool IDs (Albany via ausdk12.org, Berkeley, Emeryville, Piedmont, El Cerrito)
  - Extracts closure dates from email body and writes `closureNotice` to Firestore (surfaces as amber banner in app)
  - Fixed Firestore crash on future-dated docs by switching to `batch.set` with merge
- **Mailing list subscriptions** — poolfinderalerts@gmail.com subscribed to:
  - Albany Aquatic Center (via AUSD Wix page) — confirmed "Thanks for Subscribing!" + closure email already received
  - Piedmont Community Pool (manually signed up)
  - El Cerrito Splash Park (manually signed up via Google OAuth)
- Fixed Piedmont showing 'Coming soon' in My Pools tab despite having live schedule data — added to LIVE_POOLS set in MyPools.jsx
- Richmond Plunge added to app with scraper (static schedule from city PDF — Mon/Wed/Fri mornings + evenings, Tue/Thu evenings, Sat morning; rec swim Wed/Fri/Sat 1:30–3:30pm; closed Sundays; July 3 holiday)
- Lions Pool (Oakland) added to app with scraper (June 8 – July 31; Mon–Thu mornings/midday/evenings, Fri midday only, Sat–Sun midday)
- DeFremery and Lions promoted from "Coming soon" to live in LIVE_POOLS

---

## Feature requests

- [x] **Per-pool on/off toggle in My Pools** — toggle switch next to star in My Pools, separate per mode, saved to Firestore per user
